FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["src/TrackingService.API/TrackingService.API.csproj", "TrackingService.API/"]
COPY ["src/TrackingService.Application/TrackingService.Application.csproj", "TrackingService.Application/"]
COPY ["src/TrackingService.Domain/TrackingService.Domain.csproj", "TrackingService.Domain/"]
COPY ["src/TrackingService.Infrastructure/TrackingService.Infrastructure.csproj", "TrackingService.Infrastructure/"]
RUN dotnet restore "TrackingService.API/TrackingService.API.csproj"
COPY src/ .
RUN dotnet publish "TrackingService.API/TrackingService.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TrackingService.API.dll"]
