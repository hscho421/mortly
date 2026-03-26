import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface TrendDay {
  date: string;
  users: number;
  requests: number;
  conversations: number;
}

interface TrendChartProps {
  data: { label: string; users: number; requests: number; conversations: number }[];
  locale: string;
  trends: TrendDay[];
  t: (key: string) => string;
}

export default function TrendChart({ data, locale, trends, t }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={4} />
        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
        <Tooltip
          contentStyle={{ backgroundColor: "#1f3528", border: "none", borderRadius: 10, fontSize: 12, fontFamily: "Outfit, sans-serif", color: "#f5f0e8", padding: "10px 16px", boxShadow: "0 8px 24px rgba(31,53,40,0.25)" }}
          itemStyle={{ color: "#e8e4dc", padding: "3px 0" }}
          labelStyle={{ color: "#b8c4ae", fontWeight: 600, marginBottom: 6, fontSize: 11 }}
          labelFormatter={(label) => {
            const match = trends.find((d) => d.date.slice(5) === label);
            if (!match) return label;
            return new Date(match.date + "T12:00:00").toLocaleDateString(
              locale === "ko" ? "ko-KR" : "en-CA",
              { weekday: "short", month: "short", day: "numeric" }
            );
          }}
          cursor={{ fill: "rgba(0,0,0,0.04)", radius: 4 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontFamily: "Outfit, sans-serif", paddingTop: 12, color: "#64748b" }} />
        <Bar dataKey="users" name={t("admin.users")} fill="#3d6b4f" radius={[0, 0, 0, 0]} stackId="a" />
        <Bar dataKey="requests" name={t("admin.requests")} fill="#8faa7e" stackId="a" />
        <Bar dataKey="conversations" name={t("admin.conversations")} fill="#c8a86e" radius={[3, 3, 0, 0]} stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}
