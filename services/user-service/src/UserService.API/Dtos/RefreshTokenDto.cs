using System.ComponentModel.DataAnnotations;

namespace UserService.API.Dtos;

public class RefreshTokenDto
{
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}
