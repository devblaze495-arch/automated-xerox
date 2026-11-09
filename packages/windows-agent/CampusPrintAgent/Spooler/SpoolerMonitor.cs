using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;

namespace CampusPrintAgent.Spooler;

public record PrinterHealthReport(
    string PrinterName,
    bool IsOnline,
    bool HasError,
    bool PaperOut,
    bool PaperJam,
    uint PendingJobs,
    string StatusDescription
);

public class SpoolerMonitor
{
    private readonly ILogger<SpoolerMonitor> _logger;

    public SpoolerMonitor(ILogger<SpoolerMonitor> logger)
    {
        _logger = logger;
    }

    public PrinterHealthReport CheckPrinterHealth(string printerName)
    {
        if (!NativeMethods.OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
        {
            var err = Marshal.GetLastWin32Error();
            return new PrinterHealthReport(
                PrinterName: printerName,
                IsOnline: false,
                HasError: true,
                PaperOut: false,
                PaperJam: false,
                PendingJobs: 0,
                StatusDescription: $"Unable to open printer handle (Win32 Error: {err})"
            );
        }

        try
        {
            NativeMethods.GetPrinter(hPrinter, 2, IntPtr.Zero, 0, out var bytesNeeded);
            if (bytesNeeded == 0)
            {
                return new PrinterHealthReport(printerName, true, false, false, false, 0, "Online / Idle");
            }

            var pPrinterInfo = Marshal.AllocHGlobal((int)bytesNeeded);
            try
            {
                if (!NativeMethods.GetPrinter(hPrinter, 2, pPrinterInfo, bytesNeeded, out _))
                {
                    return new PrinterHealthReport(printerName, false, true, false, false, 0, "Failed to query printer properties");
                }

                var info2 = Marshal.PtrToStructure<NativeMethods.PRINTER_INFO_2>(pPrinterInfo);

                var isOffline = (info2.Status & NativeMethods.PRINTER_STATUS_OFFLINE) != 0;
                var hasError = (info2.Status & NativeMethods.PRINTER_STATUS_ERROR) != 0;
                var paperOut = (info2.Status & NativeMethods.PRINTER_STATUS_PAPER_OUT) != 0;
                var paperJam = (info2.Status & NativeMethods.PRINTER_STATUS_PAPER_JAM) != 0;
                var isPaused = (info2.Status & NativeMethods.PRINTER_STATUS_PAUSED) != 0;

                var descList = new List<string>();
                if (isOffline) descList.Add("OFFLINE");
                if (hasError) descList.Add("ERROR");
                if (paperOut) descList.Add("PAPER_OUT");
                if (paperJam) descList.Add("PAPER_JAM");
                if (isPaused) descList.Add("PAUSED");

                var desc = descList.Count > 0 ? string.Join(", ", descList) : "Ready / Spooling Active";

                return new PrinterHealthReport(
                    PrinterName: printerName,
                    IsOnline: !isOffline,
                    HasError: hasError,
                    PaperOut: paperOut,
                    PaperJam: paperJam,
                    PendingJobs: info2.cJobs,
                    StatusDescription: desc
                );
            }
            finally
            {
                Marshal.FreeHGlobal(pPrinterInfo);
            }
        }
        finally
        {
            NativeMethods.ClosePrinter(hPrinter);
        }
    }
}

