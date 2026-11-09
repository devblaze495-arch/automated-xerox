using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging;

namespace CampusPrintAgent.Persistence;

public class JobDeduplicator
{
    private readonly string _connectionString;
    private readonly ILogger<JobDeduplicator> _logger;

    public JobDeduplicator(string databasePath, ILogger<JobDeduplicator> logger)
    {
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate
        }.ToString();
        _logger = logger;
    }

    public async Task InitializeDatabaseAsync()
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();

        const string createTableSql = """
            CREATE TABLE IF NOT EXISTS dispatched_jobs (
                order_item_id TEXT PRIMARY KEY,
                document_name TEXT NOT NULL,
                printer_name TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                completed_at TEXT,
                error_message TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_jobs_status ON dispatched_jobs(status);
        """;

        await using var command = new SqliteCommand(createTableSql, connection);
        await command.ExecuteNonQueryAsync();

        _logger.LogInformation("Job deduplication SQLite database initialized at connection: {Conn}", _connectionString);
    }

    public async Task<bool> IsJobAlreadyProcessedAsync(string orderItemId)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();

        const string checkSql = "SELECT status FROM dispatched_jobs WHERE order_item_id = @id LIMIT 1;";
        await using var command = new SqliteCommand(checkSql, connection);
        command.Parameters.AddWithValue("@id", orderItemId);

        var result = await command.ExecuteScalarAsync();
        if (result != null)
        {
            var status = result.ToString();
            // If already COMPLETED or currently PRINTING, consider processed to avoid duplicate paper output
            return status is "COMPLETED" or "PRINTING";
        }

        return false;
    }

    public async Task RecordJobStartedAsync(string orderItemId, string documentName, string printerName)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();

        const string upsertSql = """
            INSERT INTO dispatched_jobs (order_item_id, document_name, printer_name, status, created_at)
            VALUES (@id, @doc, @printer, 'PRINTING', @now)
            ON CONFLICT(order_item_id) DO UPDATE SET
                status = 'PRINTING',
                printer_name = @printer,
                error_message = NULL;
        """;

        await using var command = new SqliteCommand(upsertSql, connection);
        command.Parameters.AddWithValue("@id", orderItemId);
        command.Parameters.AddWithValue("@doc", documentName);
        command.Parameters.AddWithValue("@printer", printerName);
        command.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("O"));

        await command.ExecuteNonQueryAsync();
    }

    public async Task RecordJobCompletedAsync(string orderItemId)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();

        const string updateSql = """
            UPDATE dispatched_jobs
            SET status = 'COMPLETED',
                completed_at = @now,
                error_message = NULL
            WHERE order_item_id = @id;
        """;

        await using var command = new SqliteCommand(updateSql, connection);
        command.Parameters.AddWithValue("@id", orderItemId);
        command.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("O"));

        await command.ExecuteNonQueryAsync();
    }

    public async Task RecordJobFailedAsync(string orderItemId, string errorMessage)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync();

        const string updateSql = """
            UPDATE dispatched_jobs
            SET status = 'FAILED',
                error_message = @err
            WHERE order_item_id = @id;
        """;

        await using var command = new SqliteCommand(updateSql, connection);
        command.Parameters.AddWithValue("@id", orderItemId);
        command.Parameters.AddWithValue("@err", errorMessage);

        await command.ExecuteNonQueryAsync();
    }
}

