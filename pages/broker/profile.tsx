import { useState, useEffect, FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import type { CreateBrokerProfileInput } from "@/types";

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Nova Scotia",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
];

interface BrokerProfile extends CreateBrokerProfileInput {
  verificationStatus: string;
  subscriptionTier: string;
  responseCredits: number;
  rating: number | null;
  completedMatches: number;
}

export default function BrokerProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [form, setForm] = useState<CreateBrokerProfileInput>({
    brokerageName: "",
    province: "",
    licenseNumber: "",
    bio: "",
    yearsExperience: undefined,
    areasServed: "",
    specialties: "",
  });
  const [verificationStatus, setVerificationStatus] = useState("PENDING");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "BROKER") {
      router.push("/login");
      return;
    }

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/brokers/profile");
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data: BrokerProfile = await res.json();
        setForm({
          brokerageName: data.brokerageName,
          province: data.province,
          licenseNumber: data.licenseNumber,
          bio: data.bio || "",
          yearsExperience: data.yearsExperience ?? undefined,
          areasServed: data.areasServed || "",
          specialties: data.specialties || "",
        });
        setVerificationStatus(data.verificationStatus);
      } catch {
        setError("Failed to load profile data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session, status, router]);

  if (status === "loading" || isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-body-sm">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "BROKER") {
    return null;
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "yearsExperience" ? (value ? parseInt(value, 10) : undefined) : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const res = await fetch("/api/brokers/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to update profile.");
        setIsSaving(false);
        return;
      }

      setSuccess("Profile updated successfully.");
      setIsSaving(false);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsSaving(false);
    }
  };

  const verificationColors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    VERIFIED: "bg-forest-100 text-forest-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="heading-lg">Edit Profile</h1>
            <p className="text-body mt-2">
              Update your broker profile information.
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 font-body text-xs font-semibold ${verificationColors[verificationStatus] || verificationColors.PENDING}`}
          >
            {verificationStatus === "VERIFIED"
              ? "Verified"
              : verificationStatus === "REJECTED"
                ? "Rejected"
                : "Pending Verification"}
          </span>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 animate-fade-in">
            <p className="font-body text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl bg-forest-50 border border-forest-200 p-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-forest-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <p className="font-body text-sm text-forest-700">{success}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card-elevated space-y-6 animate-fade-in-up">
          <div>
            <label htmlFor="brokerageName" className="label-text">
              Brokerage Name <span className="text-amber-600">*</span>
            </label>
            <input
              id="brokerageName"
              name="brokerageName"
              type="text"
              required
              value={form.brokerageName}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="province" className="label-text">
              Province <span className="text-amber-600">*</span>
            </label>
            <select
              id="province"
              name="province"
              required
              value={form.province}
              onChange={handleChange}
              className="input-field"
            >
              <option value="">Select a province</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="licenseNumber" className="label-text">
              License Number <span className="text-amber-600">*</span>
            </label>
            <input
              id="licenseNumber"
              name="licenseNumber"
              type="text"
              required
              value={form.licenseNumber}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <hr className="divider" />

          <div>
            <label htmlFor="bio" className="label-text">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              value={form.bio || ""}
              onChange={handleChange}
              className="input-field resize-none"
            />
          </div>

          <div>
            <label htmlFor="yearsExperience" className="label-text">
              Years of Experience
            </label>
            <input
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min={0}
              max={50}
              value={form.yearsExperience ?? ""}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="areasServed" className="label-text">
              Areas Served
            </label>
            <input
              id="areasServed"
              name="areasServed"
              type="text"
              value={form.areasServed || ""}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="specialties" className="label-text">
              Specialties
            </label>
            <input
              id="specialties"
              name="specialties"
              type="text"
              value={form.specialties || ""}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
