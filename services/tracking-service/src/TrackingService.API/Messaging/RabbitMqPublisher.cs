using System.Text;
using System.Text.Json;
using RabbitMQ.Client;

namespace TrackingService.API.Messaging;

public sealed class RabbitMqPublisher : IAsyncDisposable
{
    private const string ExchangeName = "user.rated_content";

    private readonly string _rabbitmqUrl;
    private IConnection? _connection;
    private IChannel? _channel;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly ILogger<RabbitMqPublisher> _logger;

    public RabbitMqPublisher(IConfiguration configuration, ILogger<RabbitMqPublisher> logger)
    {
        var host = configuration["RabbitMQ:Host"] ?? "localhost";
        var user = configuration["RabbitMQ:Username"] ?? "guest";
        var pass = configuration["RabbitMQ:Password"] ?? "guest";
        _rabbitmqUrl = $"amqp://{user}:{pass}@{host}:5672";
        _logger = logger;
    }

    public async Task PublishUserRatedAsync(string userId, string contentId, string contentType)
    {
        try
        {
            var ch = await GetChannelAsync();
            var payload = JsonSerializer.Serialize(new { userId, contentId, contentType });
            var body = Encoding.UTF8.GetBytes(payload);

            await ch.BasicPublishAsync(
                exchange: ExchangeName,
                routingKey: string.Empty,
                body: body
            );
        }
        catch (Exception ex)
        {
            // Ne srusiti korisnicki zahtev zbog RabbitMQ greske - cache ce isteći samo prirodno.
            _logger.LogError(ex, "[RabbitMqPublisher] Failed to publish UserRatedContent");
            _connection = null;
            _channel = null;
        }
    }

    private async Task<IChannel> GetChannelAsync()
    {
        if (_channel is { IsOpen: true }) return _channel;

        await _lock.WaitAsync();
        try
        {
            if (_channel is { IsOpen: true }) return _channel;

            var factory = new ConnectionFactory { Uri = new Uri(_rabbitmqUrl) };
            _connection = await factory.CreateConnectionAsync();
            _channel = await _connection.CreateChannelAsync();

            await _channel.ExchangeDeclareAsync(
                exchange: ExchangeName,
                type: ExchangeType.Fanout,
                durable: true
            );

            return _channel;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel != null) await _channel.DisposeAsync();
        if (_connection != null) await _connection.DisposeAsync();
    }
}
