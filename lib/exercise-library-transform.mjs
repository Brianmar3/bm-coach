import { localizeExercise } from "./exercise-localization-es.mjs";

const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

export function transformExerciseLibrary(source, localization) {
  const localizedSource = source.map((item) => ({ item, localized: localizeExercise(item, localization) }));
  const library = localizedSource.map(({ item, localized }) => {
    const searchable = [
      item.name,
      localized.displayNameEs,
      ...localized.aliases,
      item.body_part,
      localized.bodyPartLabelEs,
      item.equipment,
      localized.equipmentLabelEs,
      item.target,
      localized.targetMuscleLabelEs,
      item.muscle_group,
      localized.muscleGroupLabelEs,
      ...(item.secondary_muscles ?? []),
      ...localized.secondaryMusclesEs
    ];
    return {
      id: `dataset:${item.id}`,
      sourceId: item.id,
      name: item.name,
      displayName: localized.displayNameEs,
      displayNameEs: localized.displayNameEs,
      aliases: localized.aliases,
      translationStatus: localized.translationStatus,
      translationPass: localized.translationPass,
      bodyPart: item.body_part,
      bodyPartLabelEs: localized.bodyPartLabelEs,
      equipment: item.equipment,
      equipmentLabelEs: localized.equipmentLabelEs,
      targetMuscle: item.target,
      targetMuscleLabelEs: localized.targetMuscleLabelEs,
      muscleGroup: item.muscle_group,
      muscleGroupLabelEs: localized.muscleGroupLabelEs,
      secondaryMuscles: item.secondary_muscles ?? [],
      secondaryMusclesEs: localized.secondaryMusclesEs,
      instructionsEs: item.instructions.es,
      instructionStepsEs: item.instruction_steps.es,
      thumbnailPath: item.image,
      gifPath: item.gif_url,
      attribution: item.attribution,
      source: "EXERCISES_DATASET",
      searchableText: normalize(searchable.join(" "))
    };
  }).sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  return { localizedSource, library };
}
