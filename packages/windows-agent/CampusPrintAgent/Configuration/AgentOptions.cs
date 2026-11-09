namespace CampusPrintAgent.Configuration;

public class AgentOptions
{
    public const string SectionName = "Agent";

    public string CenterId { get; set; } = "CTR-CAMPUS-01";
    public string AgentSecret { get; set; } = "campus_secret_key_123";
    public string BackendSocketUrl { get; set; } = "ws://localhost:4000/api/v1/agent/socket";
    public string HostName { get; set; } = "XEROX-PC-10-50-3-5";
    public string TempSpoolDirectory { get; set; } = "spool";
    public string DatabasePath { get; set; } = "agent_cache.db";
    public List<ConfiguredPrinter> Printers { get; set; } = new();
}

public class ConfiguredPrinter
{
    public string Name { get; set; } = string.Empty;
    public string Port { get; set; } = string.Empty;
    public bool Color { get; set; }
    public bool AutoDuplex { get; set; }
    public bool ManualDuplex { get; set; }
    public bool A3 { get; set; }
}

