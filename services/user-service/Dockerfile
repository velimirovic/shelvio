FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["src/UserService.API/UserService.API.csproj", "UserService.API/"]
COPY ["src/UserService.Application/UserService.Application.csproj", "UserService.Application/"]
COPY ["src/UserService.Domain/UserService.Domain.csproj", "UserService.Domain/"]
COPY ["src/UserService.Infrastructure/UserService.Infrastructure.csproj", "UserService.Infrastructure/"]
RUN dotnet restore "UserService.API/UserService.API.csproj"
COPY src/ .
RUN dotnet publish "UserService.API/UserService.API.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "UserService.API.dll"]
