using System.ComponentModel.DataAnnotations;

namespace VolleyballTrainingTracker.Server.Validation;

/// <summary>
/// 選填的 Email 驗證：null／空字串／純空白一律視為有效（代表「未填」或「清除」），
/// 有實際內容時才套用標準 Email 格式檢查。
/// 內建的 <see cref="EmailAddressAttribute"/> 只放行 null，會把空字串判為無效，
/// 導致「清空 Email」的請求回傳 400，故以此屬性取代選填 Email 欄位。
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter,
    AllowMultiple = false)]
public sealed class OptionalEmailAddressAttribute : ValidationAttribute
{
    private static readonly EmailAddressAttribute Inner = new();

    public OptionalEmailAddressAttribute()
        : base("The Email field is not a valid e-mail address.")
    {
    }

    public override bool IsValid(object? value)
    {
        if (value is not string s || string.IsNullOrWhiteSpace(s))
            return true;
        return Inner.IsValid(s);
    }
}
