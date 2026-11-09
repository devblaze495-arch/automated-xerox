using System.Text;
using Microsoft.Extensions.Logging;

namespace CampusPrintAgent.Networking;

public class DocumentDownloader
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<DocumentDownloader> _logger;
    private static readonly byte[] PdfHeaderMagic = "%PDF-"u8.ToArray();

    public DocumentDownloader(HttpClient httpClient, ILogger<DocumentDownloader> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <summary>
    /// Downloads the PDF from the Fastify download URL to the target spool directory and verifies the %PDF- header.
    /// </summary>
    public async Task<string> DownloadAndVerifyPdfAsync(
        string downloadUrl,
        string spoolDirectory,
        string orderItemId,
        CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(spoolDirectory);
        var localFilePath = Path.Combine(spoolDirectory, $"job_{orderItemId}_{Guid.NewGuid():N}.pdf");

        _logger.LogInformation("Downloading PDF document for OrderItem [{OrderItemId}] from: {Url}", orderItemId, downloadUrl);

        using (var response = await _httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken))
        {
            response.EnsureSuccessStatusCode();

            await using var sourceStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            await using var targetStream = new FileStream(
                localFilePath,
                FileMode.Create,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true);

            await sourceStream.CopyToAsync(targetStream, cancellationToken);
        }

        // Verify PDF Header
        await VerifyPdfHeaderAsync(localFilePath, cancellationToken);

        var fileInfo = new FileInfo(localFilePath);
        _logger.LogInformation("Successfully downloaded and verified PDF [{FilePath}] ({Size:N0} bytes)", localFilePath, fileInfo.Length);

        return localFilePath;
    }

    private static async Task VerifyPdfHeaderAsync(string filePath, CancellationToken cancellationToken)
    {
        await using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var buffer = new byte[8];
        var bytesRead = await fs.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);

        if (bytesRead < 5)
        {
            throw new InvalidDataException("Downloaded file is too small to be a valid PDF document.");
        }

        for (int i = 0; i < 5; i++)
        {
            if (buffer[i] != PdfHeaderMagic[i])
            {
                var headerText = Encoding.ASCII.GetString(buffer, 0, Math.Min(bytesRead, 8));
                throw new InvalidDataException($"Invalid PDF header signature. Expected '%PDF-', found: '{headerText}'.");
            }
        }
    }
}

