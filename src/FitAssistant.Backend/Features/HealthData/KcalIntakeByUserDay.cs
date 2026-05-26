using Raven.Client.Documents.Indexes;

namespace FitAssistant.Backend.Features.HealthData;

public class KcalIntakeByUserDay : AbstractIndexCreationTask<FoodEntry, KcalIntakeByUserDay.Result>
{
    public class Result
    {
        public string UserProfileId { get; set; } = "";
        public DateTime Day { get; set; }
        public int TotalKcal { get; set; }
        public int EntryCount { get; set; }
    }

    public KcalIntakeByUserDay()
    {
        Map = entries =>
            from e in entries
            select new Result
            {
                UserProfileId = e.UserProfileId,
                Day = e.Timestamp.Date,
                TotalKcal = e.Calories,
                EntryCount = 1
            };

        Reduce = results =>
            from r in results
            group r by new { r.UserProfileId, r.Day } into g
            select new Result
            {
                UserProfileId = g.Key.UserProfileId,
                Day = g.Key.Day,
                TotalKcal = g.Sum(x => x.TotalKcal),
                EntryCount = g.Sum(x => x.EntryCount)
            };
    }
}
