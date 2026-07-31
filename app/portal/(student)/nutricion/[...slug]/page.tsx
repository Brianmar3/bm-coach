import { NutritionWorkspace } from "@/componentes/nutrition-workspace";

export default async function NutritionFeaturePage(
  props: PageProps<"/portal/nutricion/[...slug]">,
) {
  const { slug } = await props.params;
  return <NutritionWorkspace slug={slug} />;
}
