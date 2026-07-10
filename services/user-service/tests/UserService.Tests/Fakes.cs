using UserService.API.Entities;
using UserService.API.Interfaces;

namespace UserService.Tests;

// In-memory zamena za pravi repozitorijum (EF Core + Postgres) - testira se POSLOVNA
// logika AuthService-a, ne pristup bazi. Rucno pisan fake umesto mock biblioteke (Moq) -
// manje zavisnosti, ponasanje je eksplicitno vidljivo u kodu.
public class FakeUserRepository : IUserRepository
{
    public List<User> Users { get; } = [];

    public Task<User?> GetByIdAsync(Guid id) =>
        Task.FromResult(Users.FirstOrDefault(u => u.Id == id));

    public Task<User?> GetByUsernameAsync(string username) =>
        Task.FromResult(Users.FirstOrDefault(u => u.Username == username));

    public Task<User?> GetByRefreshTokenAsync(string refreshToken) =>
        Task.FromResult(Users.FirstOrDefault(u => u.RefreshToken == refreshToken));

    public Task<bool> ExistsByUsernameAsync(string username) =>
        Task.FromResult(Users.Any(u => u.Username == username));

    public Task<bool> ExistsByEmailAsync(string email) =>
        Task.FromResult(Users.Any(u => u.Email == email));

    public Task AddAsync(User user)
    {
        Users.Add(user);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync() => Task.CompletedTask;
}

// Deterministicki tokeni (brojac umesto kriptografije) - testovi proveravaju TOK
// (da li je token izdat/rotiran/obrisan), a ne sadrzaj samog tokena.
public class FakeTokenService : ITokenService
{
    private int _counter;

    public (string Token, DateTime ExpiresAt) GenerateAccessToken(User user) =>
        ($"access-{user.Username}-{++_counter}", DateTime.UtcNow.AddMinutes(15));

    public (string Token, DateTime ExpiresAt) GenerateRefreshToken() =>
        ($"refresh-{++_counter}", DateTime.UtcNow.AddDays(7));
}
