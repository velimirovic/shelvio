using System.ComponentModel.DataAnnotations;

namespace UserService.API.Dtos;

public class RegisterDto
{
    [Required]
    [MinLength(3)]
    [MaxLength(32)]
    [RegularExpression("^[a-zA-Z0-9_]+$", ErrorMessage = "Username can only contain letters, numbers and underscores.")]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string Password { get; set; } = string.Empty;
}
