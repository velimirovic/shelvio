using System.Net;

namespace TrackingService.API.Exceptions;

public class AppException : Exception
{
    public HttpStatusCode StatusCode { get; }

    public AppException(string message, HttpStatusCode statusCode) : base(message)
    {
        StatusCode = statusCode;
    }
}
