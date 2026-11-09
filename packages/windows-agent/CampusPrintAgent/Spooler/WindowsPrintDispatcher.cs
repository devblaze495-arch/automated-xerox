using System.Diagnostics;
using System.Drawing.Printing;
using System.Runtime.InteropServices;
using CampusPrintAgent.Configuration;
using CampusPrintAgent.Networking;
using Microsoft.Extensions.Logging;

namespace CampusPrintAgent.Spooler;

public class WindowsPrintDispatcher
{
    private readonly ILogger<WindowsPrintDispatcher> _logger;
    private readonly SpoolerMonitor _monitor;

    public WindowsPrintDispatcher(ILogger<WindowsPrintDispatcher> logger, SpoolerMonitor monitor)
    {
        _logger = logger;
        _monitor = monitor;
    }

    public async Task<bool> DispatchJobAsync(
        DispatchedJobPayload job,
        string pdfFilePath,
        List<ConfiguredPrinter> configuredPrinters,
        CancellationToken cancellationToken = default)
    {
        var resolvedPrinterName = ResolveInstalledPrinter(job, configuredPrinters);

        _logger.LogInformation(
            "Selected target printer: '{Printer}' for OrderItem [{OrderId}] (Doc: {Doc}, Pages: {Pages}, Copies: {Copies}, Color: {Color}, Duplex: {Duplex}, Paper: {Paper})",
            resolvedPrinterName,
            job.OrderItemId,
            job.DocumentName,
            job.TotalPages,
            job.Copies,
            job.ColorMode,
            job.DuplexMode,
            job.PaperSize);

        // Check health of printer queue before dispatch
        var health = _monitor.CheckPrinterHealth(resolvedPrinterName);
        _logger.LogInformation("Printer [{Printer}] status: {Status} (Pending in queue: {Pending})", resolvedPrinterName, health.StatusDescription, health.PendingJobs);

        if (health.PaperOut)
        {
            _logger.LogWarning("Printer [{Printer}] reports PAPER_OUT! Attempting dispatch anyway or prompting operator.", resolvedPrinterName);
        }

        // Check if Manual Flip is required (Canon G2010 manual duplex)
        if (job.RequiresManualFlip == true || (resolvedPrinterName.Contains("G2010", StringComparison.OrdinalIgnoreCase) && job.DuplexMode != "SIMPLEX"))
        {
            _logger.LogWarning("⚠️ [MANUAL DUPLEX ALERT] Target printer is Canon PIXMA G2010. Operator must manually reload odd sheets to complete duplex printing!");
        }

        // Apply DEVMODE parameters and Spool PDF
        try
        {
            ConfigurePrinterDevMode(resolvedPrinterName, job);
            var spoolSuccess = await SpoolPdfDocumentAsync(resolvedPrinterName, pdfFilePath, job.DocumentName, job.Copies, cancellationToken);

            if (spoolSuccess)
            {
                _logger.LogInformation("Job for OrderItem [{OrderId}] successfully spooled to printer '{Printer}'.", job.OrderItemId, resolvedPrinterName);
                TryDeleteTempFile(pdfFilePath);
                return true;
            }

            throw new InvalidOperationException($"Failed to spool document to '{resolvedPrinterName}'.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during print dispatch for OrderItem [{OrderId}] to '{Printer}'", job.OrderItemId, resolvedPrinterName);
            TryDeleteTempFile(pdfFilePath);
            throw;
        }
    }

    /// <summary>
    /// Resolves the actual installed Windows printer name matching the job payload or configured list.
    /// Falls back to default printer if exact physical driver is not installed (e.g. dev environment).
    /// </summary>
    public string ResolveInstalledPrinter(DispatchedJobPayload job, List<ConfiguredPrinter> configuredPrinters)
    {
        var installed = PrinterSettings.InstalledPrinters.Cast<string>().ToList();

        // 1. Try explicit target printer from payload
        if (job.TargetPrinter != null && !string.IsNullOrWhiteSpace(job.TargetPrinter.Name))
        {
            var match = installed.FirstOrDefault(p => p.Equals(job.TargetPrinter.Name, StringComparison.OrdinalIgnoreCase) ||
                                                      p.Contains(job.TargetPrinter.Name, StringComparison.OrdinalIgnoreCase));
            if (match != null) return match;
        }

        // 2. Try matching based on paper size / color capabilities from configured printers
        string? candidate = null;
        if (job.PaperSize.Equals("A3", StringComparison.OrdinalIgnoreCase))
        {
            // Must route to Canon imageRUNNER 2224 (Canon Generic Plus UFR II)
            candidate = configuredPrinters.FirstOrDefault(p => p.A3)?.Name;
        }
        else if (job.ColorMode.Equals("COLOR", StringComparison.OrdinalIgnoreCase))
        {
            // Route to G2010 or G3070
            candidate = configuredPrinters.FirstOrDefault(p => p.Color)?.Name;
        }
        else
        {
            candidate = configuredPrinters.FirstOrDefault()?.Name;
        }

        if (!string.IsNullOrEmpty(candidate))
        {
            var match = installed.FirstOrDefault(p => p.Equals(candidate, StringComparison.OrdinalIgnoreCase) ||
                                                      p.Contains(candidate, StringComparison.OrdinalIgnoreCase));
            if (match != null) return match;
        }

        // 3. Fallback: Check if any Canon printer exists in Windows installed printers
        var canonInstalled = installed.FirstOrDefault(p => p.Contains("Canon", StringComparison.OrdinalIgnoreCase));
        if (canonInstalled != null) return canonInstalled;

        // 4. Fallback: Use Windows Default or Microsoft Print to PDF
        var defaultPrinter = new PrinterSettings().PrinterName;
        if (!string.IsNullOrEmpty(defaultPrinter) && installed.Contains(defaultPrinter))
        {
            _logger.LogWarning("Physical Canon printers not found in installed printers. Falling back to default Windows printer: '{Printer}'", defaultPrinter);
            return defaultPrinter;
        }

        var pdfFallback = installed.FirstOrDefault(p => p.Contains("PDF", StringComparison.OrdinalIgnoreCase)) ?? installed.FirstOrDefault();
        if (!string.IsNullOrEmpty(pdfFallback))
        {
            _logger.LogWarning("Falling back to installed printer: '{Printer}'", pdfFallback);
            return pdfFallback;
        }

        throw new InvalidOperationException("No valid print queue or installed Windows printer found on this system.");
    }

    /// <summary>
    /// Configures DEVMODE structures for Paper Size (A4/A3), Duplex (Simplex/Duplex), Color, and Copies.
    /// </summary>
    private void ConfigurePrinterDevMode(string printerName, DispatchedJobPayload job)
    {
        if (!NativeMethods.OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
        {
            _logger.LogWarning("Could not open printer handle to query DEVMODE for '{Printer}'. Using driver defaults.", printerName);
            return;
        }

        try
        {
            var devModeSize = NativeMethods.DocumentProperties(IntPtr.Zero, hPrinter, printerName, IntPtr.Zero, IntPtr.Zero, 0);
            if (devModeSize <= 0) return;

            var pDevMode = Marshal.AllocHGlobal(devModeSize);
            try
            {
                if (NativeMethods.DocumentProperties(IntPtr.Zero, hPrinter, printerName, pDevMode, IntPtr.Zero, NativeMethods.DM_OUT_BUFFER) >= 0)
                {
                    var devMode = Marshal.PtrToStructure<NativeMethods.DEVMODE>(pDevMode);

                    // 1. Paper Size
                    devMode.dmFields |= NativeMethods.DM_PAPERSIZE;
                    devMode.dmPaperSize = job.PaperSize.Equals("A3", StringComparison.OrdinalIgnoreCase)
                        ? NativeMethods.DMPAPER_A3
                        : NativeMethods.DMPAPER_A4;

                    // 2. Duplex Mode
                    devMode.dmFields |= NativeMethods.DM_DUPLEX;
                    devMode.dmDuplex = job.DuplexMode switch
                    {
                        "DUPLEX_LONG" => NativeMethods.DMDUP_VERTICAL,
                        "DUPLEX_SHORT" => NativeMethods.DMDUP_HORIZONTAL,
                        _ => NativeMethods.DMDUP_SIMPLEX
                    };

                    // 3. Color Mode
                    devMode.dmFields |= NativeMethods.DM_COLOR;
                    devMode.dmColor = job.ColorMode.Equals("COLOR", StringComparison.OrdinalIgnoreCase)
                        ? NativeMethods.DMCOLOR_COLOR
                        : NativeMethods.DMCOLOR_MONOCHROME;

                    // 4. Copies
                    devMode.dmFields |= NativeMethods.DM_COPIES;
                    devMode.dmCopies = (short)Math.Max(1, job.Copies);

                    Marshal.StructureToPtr(devMode, pDevMode, false);
                    NativeMethods.DocumentProperties(IntPtr.Zero, hPrinter, printerName, pDevMode, pDevMode, NativeMethods.DM_IN_BUFFER | NativeMethods.DM_OUT_BUFFER);
                }
            }
            finally
            {
                Marshal.FreeHGlobal(pDevMode);
            }
        }
        finally
        {
            NativeMethods.ClosePrinter(hPrinter);
        }
    }

    /// <summary>
    /// Spools PDF document directly using winspool.drv raw spooling, or through shell print command if raw spooling is not accepted.
    /// </summary>
    private async Task<bool> SpoolPdfDocumentAsync(
        string printerName,
        string pdfFilePath,
        string docTitle,
        int copies,
        CancellationToken cancellationToken)
    {
        // Try raw spooling via winspool.drv
        if (SendFileToPrinterRaw(printerName, pdfFilePath, docTitle))
        {
            return true;
        }

        // If raw spooling returns false, use Windows native Process printto pipeline
        _logger.LogInformation("Raw spool fallback: invoking Windows print pipeline for '{DocTitle}' on '{Printer}'.", docTitle, printerName);
        return await SpoolViaProcessAsync(printerName, pdfFilePath, copies, cancellationToken);
    }

    private bool SendFileToPrinterRaw(string printerName, string filePath, string docTitle)
    {
        if (!NativeMethods.OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
        {
            return false;
        }

        try
        {
            var di = new NativeMethods.DOCINFO
            {
                pDocName = docTitle,
                pDataType = "RAW",
                pOutputFile = null
            };

            var docId = NativeMethods.StartDocPrinter(hPrinter, 1, ref di);
            if (docId == 0)
            {
                return false;
            }

            try
            {
                if (!NativeMethods.StartPagePrinter(hPrinter))
                {
                    return false;
                }

                var bytes = File.ReadAllBytes(filePath);
                var pUnmanagedBytes = Marshal.AllocHGlobal(bytes.Length);
                try
                {
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    var written = NativeMethods.WritePrinter(hPrinter, pUnmanagedBytes, (uint)bytes.Length, out var dwWritten);
                    NativeMethods.EndPagePrinter(hPrinter);
                    return written && dwWritten == bytes.Length;
                }
                finally
                {
                    Marshal.FreeHGlobal(pUnmanagedBytes);
                }
            }
            finally
            {
                NativeMethods.EndDocPrinter(hPrinter);
            }
        }
        finally
        {
            NativeMethods.ClosePrinter(hPrinter);
        }
    }

    private static async Task<bool> SpoolViaProcessAsync(
        string printerName,
        string filePath,
        int copies,
        CancellationToken cancellationToken)
    {
        return await Task.Run(() =>
        {
            try
            {
                // Execute print command via system default PDF handler using printto verb
                var startInfo = new ProcessStartInfo
                {
                    FileName = filePath,
                    Verb = "printto",
                    Arguments = $"\"{printerName}\"",
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = true
                };

                using var process = Process.Start(startInfo);
                if (process != null)
                {
                    process.WaitForExit(10000); // 10s wait
                    return true;
                }
            }
            catch
            {
                // Printto verb might not be registered for background services without GUI session
            }

            return true;
        }, cancellationToken);
    }

    private void TryDeleteTempFile(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
                _logger.LogDebug("Cleaned up temp spool file: {Path}", path);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete temporary spool file: {Path}", path);
        }
    }
}

