namespace FitAssistant.Backend.Features.HealthData;

public class FoodEntry
{
    public string? Id { get; set; }
    public required string UserProfileId { get; set; }
    public DateTime Timestamp { get; set; }
    public required string Description { get; set; }
    public int Calories { get; set; }
}
