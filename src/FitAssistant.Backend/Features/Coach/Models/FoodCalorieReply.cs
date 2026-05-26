namespace FitAssistant.Backend.Features.Coach.Models;


public class FoodCalorieReply
{
    public string Description { get; set; } = "";
    public int Calories { get; set; }
    public bool IsFood { get; set; } = true;
}
