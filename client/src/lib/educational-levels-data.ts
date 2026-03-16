export interface LevelOption {
  value: string;
  label: string;
  children?: LevelOption[];
}

export const EDUCATIONAL_HIERARCHY: LevelOption[] = [
  {
    value: "Pre-School",
    label: "Pre-School",
    children: [
      { value: "Nursery", label: "Nursery" },
      { value: "Kinder 1", label: "Kinder 1" },
      { value: "Kinder 2", label: "Kinder 2" },
      { value: "Others", label: "Others (Specify)" },
    ],
  },
  {
    value: "Primary",
    label: "Primary",
    children: [
      { value: "Grade 1", label: "Grade 1" },
      { value: "Grade 2", label: "Grade 2" },
      { value: "Grade 3", label: "Grade 3" },
      { value: "Grade 4", label: "Grade 4" },
      { value: "Grade 5", label: "Grade 5" },
      { value: "Grade 6", label: "Grade 6" },
      { value: "Others", label: "Others (Specify)" },
    ],
  },
  {
    value: "Junior High",
    label: "Junior High School",
    children: [
      { value: "Grade 7", label: "Grade 7" },
      { value: "Grade 8", label: "Grade 8" },
      { value: "Grade 9", label: "Grade 9" },
      { value: "Grade 10", label: "Grade 10" },
      { value: "Others", label: "Others (Specify)" },
    ],
  },
  {
    value: "Senior High",
    label: "Senior High School",
    children: [
      { value: "Grade 11", label: "Grade 11" },
      { value: "Grade 12", label: "Grade 12" },
      { value: "Others", label: "Others (Specify)" },
    ],
  },
  {
    value: "TVET",
    label: "Technical-Vocational (TVET)",
    children: [
      {
        value: "Agriculture & Fishery",
        label: "Agriculture & Fishery",
        children: [
          { value: "NC I", label: "NC I" },
          { value: "NC II", label: "NC II" },
          { value: "NC III", label: "NC III" },
          { value: "NC IV", label: "NC IV" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "ICT",
        label: "Information & Communications Technology",
        children: [
          { value: "NC I", label: "NC I" },
          { value: "NC II", label: "NC II" },
          { value: "NC III", label: "NC III" },
          { value: "NC IV", label: "NC IV" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Tourism",
        label: "Tourism",
        children: [
          { value: "NC I", label: "NC I" },
          { value: "NC II", label: "NC II" },
          { value: "NC III", label: "NC III" },
          { value: "NC IV", label: "NC IV" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Health & Social Services",
        label: "Health & Social Services",
        children: [
          { value: "NC I", label: "NC I" },
          { value: "NC II", label: "NC II" },
          { value: "NC III", label: "NC III" },
          { value: "NC IV", label: "NC IV" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Electronics",
        label: "Electronics",
        children: [
          { value: "NC I", label: "NC I" },
          { value: "NC II", label: "NC II" },
          { value: "NC III", label: "NC III" },
          { value: "NC IV", label: "NC IV" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Automotive",
        label: "Automotive",
        children: [
          { value: "NC I", label: "NC I" },
          { value: "NC II", label: "NC II" },
          { value: "NC III", label: "NC III" },
          { value: "NC IV", label: "NC IV" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Others",
        label: "Others (Specify)",
        children: [
          { value: "NC I", label: "NC I" },
          { value: "NC II", label: "NC II" },
          { value: "NC III", label: "NC III" },
          { value: "NC IV", label: "NC IV" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
    ],
  },
  {
    value: "Tertiary",
    label: "Tertiary Education",
    children: [
      {
        value: "Associate Degree",
        label: "Associate Degree",
        children: [
          { value: "Business Administration", label: "Business Administration" },
          { value: "Computer Science", label: "Computer Science" },
          { value: "Engineering Technology", label: "Engineering Technology" },
          { value: "Health Sciences", label: "Health Sciences" },
          { value: "Education", label: "Education" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Bachelor's Degree",
        label: "Bachelor's Degree",
        children: [
          { value: "Business Administration", label: "Business Administration" },
          { value: "Computer Science", label: "Computer Science" },
          { value: "Engineering", label: "Engineering" },
          { value: "Education", label: "Education" },
          { value: "Nursing", label: "Nursing" },
          { value: "Accountancy", label: "Accountancy" },
          { value: "Arts & Sciences", label: "Arts & Sciences" },
          { value: "Information Technology", label: "Information Technology" },
          { value: "Criminology", label: "Criminology" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      { value: "Others", label: "Others (Specify)" },
    ],
  },
  {
    value: "Professional Degree",
    label: "Professional Degree",
    children: [
      {
        value: "Licensed Professional (PRC)",
        label: "Licensed Professional (PRC-Regulated)",
        children: [
          { value: "Medicine (MD)", label: "Medicine (MD)" },
          { value: "Law (JD)", label: "Law (JD)" },
          { value: "Dentistry (DMD)", label: "Dentistry (DMD)" },
          { value: "Pharmacy (PharmD)", label: "Pharmacy (PharmD)" },
          { value: "Veterinary Medicine (DVM)", label: "Veterinary Medicine (DVM)" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Advanced Post-Graduate",
        label: "Advanced Post-Graduate",
        children: [
          { value: "Doctor of Laws (LLD)", label: "Doctor of Laws (LLD)" },
          { value: "Specialty Medicine", label: "Specialty Medicine" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      { value: "Others", label: "Others (Specify)" },
    ],
  },
  {
    value: "Graduate Education",
    label: "Graduate Education",
    children: [
      {
        value: "Professional Certificate",
        label: "Professional Certificate (CPE/TCP)",
        children: [
          { value: "Teaching Certificate", label: "Teaching Certificate" },
          { value: "Management Certificate", label: "Management Certificate" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Master's Degree",
        label: "Master's Degree",
        children: [
          { value: "Master of Arts (MA)", label: "Master of Arts (MA)" },
          { value: "Master of Science (MS)", label: "Master of Science (MS)" },
          { value: "Master of Business Administration (MBA)", label: "MBA" },
          { value: "Master in Education (MAEd)", label: "Master in Education (MAEd)" },
          { value: "Master in Public Administration (MPA)", label: "MPA" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      {
        value: "Doctorate Degree",
        label: "Doctorate Degree",
        children: [
          { value: "Doctor of Philosophy (PhD)", label: "Doctor of Philosophy (PhD)" },
          { value: "Doctor of Education (EdD)", label: "Doctor of Education (EdD)" },
          { value: "Others", label: "Others (Specify)" },
        ],
      },
      { value: "Others", label: "Others (Specify)" },
    ],
  },
  {
    value: "Others",
    label: "Others (Specify)",
  },
];

export function generateSchoolYears(): string[] {
  const years: string[] = [];
  for (let y = 2020; y <= 2049; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

export function getCurrentSchoolYear(fiscalPeriod?: string | null): string {
  const now = new Date();
  const year = now.getFullYear();

  if (fiscalPeriod && /^\d{2}\/\d{2}$/.test(fiscalPeriod)) {
    const [fpMonth, fpDay] = fiscalPeriod.split("/").map(Number);
    const fiscalDate = new Date(year, fpMonth - 1, fpDay);
    if (now >= fiscalDate) {
      return `${year}-${year + 1}`;
    }
    return `${year - 1}-${year}`;
  }

  const month = now.getMonth() + 1;
  if (month >= 6) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

export function isSchoolYearLocked(schoolYear: string, fiscalPeriod?: string | null): boolean {
  const currentSY = getCurrentSchoolYear(fiscalPeriod);
  return schoolYear < currentSY;
}
