using System.Net;
using UserService.API.Dtos;
using UserService.API.Entities;
using UserService.API.Exceptions;
using UserService.API.Interfaces;

namespace UserService.API.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;

    public AuthService(IUserRepository userRepository, ITokenService tokenService)
    {
        _userRepository = userRepository;
        _tokenService = tokenService;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
    {
        if (await _userRepository.ExistsByUsernameAsync(dto.Username))
        {
            throw new AppException("Username is already taken.", HttpStatusCode.Conflict);
        }

        if (await _userRepository.ExistsByEmailAsync(dto.Email))
        {
            throw new AppException("Email is already registered.", HttpStatusCode.Conflict);
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.EnhancedHashPassword(dto.Password, 12),
            CreatedAt = DateTime.UtcNow
        };

        await _userRepository.AddAsync(user);
        await _userRepository.SaveChangesAsync();

        return await BuildAuthResponseAsync(user);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        var user = await _userRepository.GetByUsernameAsync(dto.Username);

        if (user is null || !BCrypt.Net.BCrypt.EnhancedVerify(dto.Password, user.PasswordHash))
        {
            throw new AppException("Invalid username or password.", HttpStatusCode.Unauthorized);
        }

        return await BuildAuthResponseAsync(user);
    }

    public async Task<AuthResponseDto> RefreshTokenAsync(string refreshToken)
    {
        var user = await _userRepository.GetByRefreshTokenAsync(refreshToken);

        if (user is null || user.RefreshTokenExpiryTime is null || user.RefreshTokenExpiryTime < DateTime.UtcNow)
        {
            throw new AppException("Refresh token is invalid or has expired.", HttpStatusCode.Unauthorized);
        }

        return await BuildAuthResponseAsync(user);
    }

    public async Task LogoutAsync(string refreshToken)
    {
        var user = await _userRepository.GetByRefreshTokenAsync(refreshToken);

        if (user is null)
        {
            return;
        }

        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        await _userRepository.SaveChangesAsync();
    }

    public async Task<UserDto> GetMeAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);

        if (user is null)
        {
            throw new AppException("User not found.", HttpStatusCode.NotFound);
        }

        return MapToDto(user);
    }

    private async Task<AuthResponseDto> BuildAuthResponseAsync(User user)
    {
        var (accessToken, accessExpiresAt) = _tokenService.GenerateAccessToken(user);
        var (refreshToken, refreshExpiresAt) = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = refreshExpiresAt;
        await _userRepository.SaveChangesAsync();

        return new AuthResponseDto
        {
            AccessToken = accessToken,
            AccessTokenExpiresAt = accessExpiresAt,
            RefreshToken = refreshToken,
            RefreshTokenExpiresAt = refreshExpiresAt,
            User = MapToDto(user)
        };
    }

    private static UserDto MapToDto(User user) => new()
    {
        Id = user.Id,
        Username = user.Username,
        Email = user.Email,
        CreatedAt = user.CreatedAt
    };
}
