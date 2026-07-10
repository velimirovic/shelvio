using System.Net;
using UserService.API.Dtos;
using UserService.API.Entities;
using UserService.API.Exceptions;
using UserService.API.Services;

namespace UserService.Tests;

public class AuthServiceTests
{
    private readonly FakeUserRepository _repository = new();
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        _service = new AuthService(_repository, new FakeTokenService());
    }

    private static RegisterDto ValidRegisterDto(string username = "marko", string email = "marko@test.com") =>
        new() { Username = username, Email = email, Password = "correct-password" };

    private async Task<User> SeedRegisteredUserAsync()
    {
        await _service.RegisterAsync(ValidRegisterDto());
        return _repository.Users.Single();
    }

    // ─── Register ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Register_StoresBcryptHashInsteadOfPlainTextPassword()
    {
        var response = await _service.RegisterAsync(ValidRegisterDto());

        var user = _repository.Users.Single();
        Assert.NotEqual("correct-password", user.PasswordHash);
        Assert.True(BCrypt.Net.BCrypt.EnhancedVerify("correct-password", user.PasswordHash));
        Assert.Equal("marko", response.User.Username);
        Assert.False(string.IsNullOrEmpty(response.AccessToken));
        Assert.Equal(user.RefreshToken, response.RefreshToken);
    }

    [Fact]
    public async Task Register_DuplicateUsername_ThrowsConflict()
    {
        await SeedRegisteredUserAsync();

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            _service.RegisterAsync(ValidRegisterDto(email: "other@test.com")));

        Assert.Equal(HttpStatusCode.Conflict, ex.StatusCode);
    }

    [Fact]
    public async Task Register_DuplicateEmail_ThrowsConflict()
    {
        await SeedRegisteredUserAsync();

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            _service.RegisterAsync(ValidRegisterDto(username: "other")));

        Assert.Equal(HttpStatusCode.Conflict, ex.StatusCode);
    }

    // ─── Login ──────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_WithCorrectCredentials_RotatesRefreshToken()
    {
        var user = await SeedRegisteredUserAsync();
        var tokenBeforeLogin = user.RefreshToken;

        var response = await _service.LoginAsync(new LoginDto { Username = "marko", Password = "correct-password" });

        Assert.NotEqual(tokenBeforeLogin, response.RefreshToken);
        Assert.Equal(user.RefreshToken, response.RefreshToken);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ThrowsUnauthorized()
    {
        await SeedRegisteredUserAsync();

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            _service.LoginAsync(new LoginDto { Username = "marko", Password = "wrong-password" }));

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
    }

    [Fact]
    public async Task Login_WithUnknownUsername_ThrowsUnauthorized()
    {
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            _service.LoginAsync(new LoginDto { Username = "ghost", Password = "correct-password" }));

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
    }

    // ─── Refresh token ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Refresh_WithValidToken_IssuesNewPairAndInvalidatesOldToken()
    {
        var user = await SeedRegisteredUserAsync();
        var oldToken = user.RefreshToken!;

        var response = await _service.RefreshTokenAsync(oldToken);

        Assert.NotEqual(oldToken, response.RefreshToken);
        // Stari token je prepisan novim - ponovna upotreba mora da padne (rotacija).
        var ex = await Assert.ThrowsAsync<AppException>(() => _service.RefreshTokenAsync(oldToken));
        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
    }

    [Fact]
    public async Task Refresh_WithExpiredToken_ThrowsUnauthorized()
    {
        var user = await SeedRegisteredUserAsync();
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddMinutes(-1);

        var ex = await Assert.ThrowsAsync<AppException>(() =>
            _service.RefreshTokenAsync(user.RefreshToken!));

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
    }

    [Fact]
    public async Task Refresh_WithUnknownToken_ThrowsUnauthorized()
    {
        var ex = await Assert.ThrowsAsync<AppException>(() =>
            _service.RefreshTokenAsync("no-such-token"));

        Assert.Equal(HttpStatusCode.Unauthorized, ex.StatusCode);
    }

    // ─── Logout ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Logout_ClearsRefreshTokenSoItCannotBeUsedAgain()
    {
        var user = await SeedRegisteredUserAsync();
        var token = user.RefreshToken!;

        await _service.LogoutAsync(token);

        Assert.Null(user.RefreshToken);
        Assert.Null(user.RefreshTokenExpiryTime);
        await Assert.ThrowsAsync<AppException>(() => _service.RefreshTokenAsync(token));
    }

    [Fact]
    public async Task Logout_WithUnknownToken_IsANoOp()
    {
        var user = await SeedRegisteredUserAsync();

        await _service.LogoutAsync("no-such-token");

        Assert.NotNull(user.RefreshToken); // postojeca sesija netaknuta
    }
}
