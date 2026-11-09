using CampusPrintAgent;
using CampusPrintAgent.Configuration;
using CampusPrintAgent.Networking;
using CampusPrintAgent.Persistence;
using CampusPrintAgent.Spooler;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

var builder = Host.CreateApplicationBuilder(args);

// Enable Windows Service lifecycle integration (sc.exe / services.msc)
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "CampusPrintAgent";
});

// Configure strongly typed Agent options
builder.Services.Configure<AgentOptions>(
    builder.Configuration.GetSection(AgentOptions.SectionName));

// Register HTTP Client for PDF streaming
builder.Services.AddHttpClient<DocumentDownloader>(client =>
{
    client.Timeout = TimeSpan.FromMinutes(3);
});

// Register SQLite Job Deduplicator
builder.Services.AddSingleton<JobDeduplicator>(sp =>
{
    var options = sp.GetRequiredService<IOptions<AgentOptions>>().Value;
    var logger = sp.GetRequiredService<ILogger<JobDeduplicator>>();
    return new JobDeduplicator(options.DatabasePath, logger);
});

// Register Spooler Monitor and Dispatcher
builder.Services.AddSingleton<SpoolerMonitor>();
builder.Services.AddSingleton<WindowsPrintDispatcher>();

// Register Resilient WebSocket Client
builder.Services.AddSingleton<AgentWebSocketClient>();

// Register Main Worker Background Service
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();

