export type NutritionIngredient = {
  name: string;
  quantity: number | null;
  unit: string;
  category: string;
  optional?: boolean;
};

export type NutritionRecipeResult = {
  id?: string;
  title: string;
  description: string;
  servings: number;
  preparationMinutes: number;
  difficulty: "Fácil" | "Intermedia";
  ingredients: NutritionIngredient[];
  steps: string[];
  equipment: string[];
  substitutions: Array<{ ingredient: string; replacement: string }>;
  rationale: string;
  warnings: string[];
  tags: string[];
  mealTypes?: string[];
  essentialIngredients?: string[];
  optionalIngredients?: string[];
  condiments?: string[];
  compatibleRestrictions?: string[];
  portable?: boolean;
  requiresCooking?: boolean;
  argentinianContext?: string[];
  budgetLevel?: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH";
  region?: string;
  objectiveTags?: string[];
  trainingTags?: string[];
  mainProtein?: string;
  carbBase?: string;
  cookingMethod?: string;
  reusable?: boolean;
};

export type NutritionPlanMeal = {
  id: string;
  dateKey: string;
  mealType: string;
  title: string;
  suggestedTime: string;
  relationToTraining: string;
  status: "PLANNED" | "COMPLETED";
};

export type NutritionShoppingItem = NutritionIngredient & {
  id: string;
  checked: boolean;
};

export type NutritionProfileData = {
  dietaryType: string;
  allergies: string[];
  intolerances: string[];
  restrictions: string[];
  preferredFoods: string[];
  dislikedFoods: string[];
  budgetPreference: string;
  cookingTimeMinutes: number | null;
  cookingLevel: string;
  equipment: string[];
  servings: number;
  usualMealTimes: Record<string, string>;
  repetitionPreference: string;
  varietyPreference: string;
  locale: string;
  consentAt: string | null;
  personalizationEnabled: boolean;
  notificationPreferences: Record<string, boolean>;
  updatedAt: string | null;
};

export type NutritionContextSnapshot = {
  today: string;
  localHour: number;
  student: {
    firstName: string;
    objective: string;
    birthDate: string;
    age: number | null;
    plan: string;
    serviceType: "CLASSES" | "PERSONALIZED" | "MIXED";
    joinedAt: string;
  };
  evaluation: {
    id: string;
    date: string;
    weight: number | null;
    height: number | null;
    bodyFatPercentage: number | null;
    muscleMass: number | null;
    visceralFat: number | null;
    waist: number | null;
    hip: number | null;
  } | null;
  profile: NutritionProfileData;
  training: {
    routineName: string | null;
    routineDays: string[];
    scheduledClasses: Array<{
      dayOfWeek: string;
      startTime: string;
      classType: string;
    }>;
    todayActivities: Array<{
      source: "OCCURRENCE" | "SCHEDULE" | "ROUTINE";
      name: string;
      startTime: string;
      status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "GENERAL";
    }>;
    relevantActivity: {
      source: "OCCURRENCE" | "SCHEDULE" | "ROUTINE";
      name: string;
      startTime: string;
      status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "GENERAL";
    } | null;
    recentAttendances: number;
  };
  habits: {
    daysRegistered: number;
    compliancePercentage: number;
    strongestHabit: string | null;
    habitToImprove: string | null;
  };
  activePlan: {
    id: string;
    startDate: string;
    endDate: string;
  } | null;
};

export type NutritionDashboardData = {
  today: string;
  studentName: string;
  objective: string;
  evaluation: import("@/types/nutrition").NutritionEvaluationReference | null;
  contextStatus: "FULL" | "LIMITED" | "BASE";
  profile: NutritionProfileData;
  recommendation: {
    title: string;
    message: string;
    href: string;
    action: string;
  };
  todayCheckin: import("@/types/nutrition").NutritionCheckin | null;
  weekCheckins: import("@/types/nutrition").NutritionCheckin[];
  summary: import("@/types/nutrition").NutritionSummary;
  trainerNote: import("@/types/nutrition").NutritionTrainerNote | null;
  activePlan: {
    id: string;
    startDate: string;
    endDate: string;
    meals: NutritionPlanMeal[];
  } | null;
  activeShoppingList: {
    id: string;
    title: string;
    items: NutritionShoppingItem[];
  } | null;
  recentRecipes: Array<{
    id: string;
    title: string;
    preparationMinutes: number;
    isFavorite: boolean;
  }>;
  ai: {
    configured: boolean;
    enabled: boolean;
    remainingToday: number;
  };
  evaluationUpdated: boolean;
};
