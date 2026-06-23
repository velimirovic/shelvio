using Microsoft.EntityFrameworkCore;
using UserService.API.Data;
using UserService.API.Entities;
using UserService.API.Interfaces;

namespace UserService.API.Repositories;

public class UserRepository : IUserRepository
{
    private readonly UserDbContext _context;

    public UserRepository(UserDbContext context)
    {
        _context = context;
    }

    public Task<User?> GetByIdAsync(Guid id) =>
        _context.Users.FirstOrDefaultAsync(u => u.Id == id);

    public Task<User?> GetByUsernameAsync(string username) =>
        _context.Users.FirstOrDefaultAsync(u => u.Username == username);

    public Task<User?> GetByRefreshTokenAsync(string refreshToken) =>
        _context.Users.FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);

    public Task<bool> ExistsByUsernameAsync(string username) =>
        _context.Users.AnyAsync(u => u.Username == username);

    public Task<bool> ExistsByEmailAsync(string email) =>
        _context.Users.AnyAsync(u => u.Email == email);

    public async Task AddAsync(User user) =>
        await _context.Users.AddAsync(user);

    public Task SaveChangesAsync() =>
        _context.SaveChangesAsync();
}
