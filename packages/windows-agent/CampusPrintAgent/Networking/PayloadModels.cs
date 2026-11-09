using System.Text.Json.Serialization;

namespace CampusPrintAgent.Networking;

public class DeviceRegisterMessage
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "DEVICE_REGISTER";

    [JsonPropertyName("centerId")]
    public string CenterId { get; set; } = string.Empty;

    [JsonPropertyName("agentSecret")]
    public string AgentSecret { get; set; } = string.Empty;

    [JsonPropertyName("platform")]
    public string Platform { get; set; } = "WINDOWS_AGENT_NET8";

    [JsonPropertyName("hostName")]
    public string HostName { get; set; } = Environment.MachineName;

    [JsonPropertyName("deviceModel")]
    public string DeviceModel { get; set; } = "Windows 10 x64 (.NET 8 Background Service)";

    [JsonPropertyName("appVersion")]
    public string AppVersion { get; set; } = "1.0.0";

    [JsonPropertyName("printers")]
    public List<PrinterRegistrationDto> Printers { get; set; } = new();
}

public class PrinterRegistrationDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("port")]
    public string Port { get; set; } = string.Empty;

    [JsonPropertyName("color")]
    public bool Color { get; set; }

    [JsonPropertyName("autoDuplex")]
    public bool AutoDuplex { get; set; }

    [JsonPropertyName("manualDuplex")]
    public bool ManualDuplex { get; set; }

    [JsonPropertyName("a3")]
    public bool A3 { get; set; }
}

public class JobStatusUpdateMessage
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "JOB_STATUS_UPDATE";

    [JsonPropertyName("orderItemId")]
    public string OrderItemId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty; // PRINTING | COMPLETED | FAILED

    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; set; }

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}

public class HeartbeatMessage
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "HEARTBEAT";

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}

public class ServerMessage
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("centerId")]
    public string? CenterId { get; set; }

    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("payload")]
    public DispatchedJobPayload? Payload { get; set; }

    [JsonPropertyName("timestamp")]
    public long? Timestamp { get; set; }
}

public class DispatchedJobPayload
{
    [JsonPropertyName("orderItemId")]
    public string OrderItemId { get; set; } = string.Empty;

    [JsonPropertyName("documentName")]
    public string DocumentName { get; set; } = "document.pdf";

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; set; } = 1;

    [JsonPropertyName("colorMode")]
    public string ColorMode { get; set; } = "BW"; // BW | COLOR

    [JsonPropertyName("duplexMode")]
    public string DuplexMode { get; set; } = "SIMPLEX"; // SIMPLEX | DUPLEX_LONG | DUPLEX_SHORT

    [JsonPropertyName("paperSize")]
    public string PaperSize { get; set; } = "A4"; // A4 | A3

    [JsonPropertyName("copies")]
    public int Copies { get; set; } = 1;

    [JsonPropertyName("downloadUrl")]
    public string DownloadUrl { get; set; } = string.Empty;

    [JsonPropertyName("createdAt")]
    public long CreatedAt { get; set; }

    [JsonPropertyName("targetPrinter")]
    public TargetPrinterDto? TargetPrinter { get; set; }

    [JsonPropertyName("requiresManualFlip")]
    public bool? RequiresManualFlip { get; set; }
}

public class TargetPrinterDto
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("portName")]
    public string? PortName { get; set; }
}

