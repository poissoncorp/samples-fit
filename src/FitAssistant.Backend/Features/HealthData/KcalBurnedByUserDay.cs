using Raven.Client.Documents.Indexes;

namespace FitAssistant.Backend.Features.HealthData;

public class KcalBurnedByUserDay : AbstractIndexCreationTask<ExerciseSession, KcalBurnedByUserDay.Result>
{
    public class Result
    {
        public string UserProfileId { get; set; } = "";
        public DateTime Day { get; set; }
        public int TotalKcal { get; set; }
        public int SessionCount { get; set; }
    }

    public KcalBurnedByUserDay()
    {
        Map = sessions =>
            from s in sessions
            where s.EndTime != null
            select new Result
            {
                UserProfileId = s.UserProfileId,
                Day = s.StartTime.Date,
                TotalKcal = s.CaloriesBurned,
                SessionCount = 1
            };

        Reduce = results =>
            from r in results
            group r by new { r.UserProfileId, r.Day } into g
            select new Result
            {
                UserProfileId = g.Key.UserProfileId,
                Day = g.Key.Day,
                TotalKcal = g.Sum(x => x.TotalKcal),
                SessionCount = g.Sum(x => x.SessionCount)
            };
    }
}
