import type { PhysicalTimeline, PhysicalTimelineEvent, StateSnapshot } from '../types/simulation'

const timeToleranceUs = 1e-12

export function clampSimulationTime(simulationTimeUs: number, totalDurationUs: number) {
  if (!Number.isFinite(simulationTimeUs) || totalDurationUs <= 0) return 0
  return Math.min(totalDurationUs, Math.max(0, simulationTimeUs))
}

export function activePhysicalTimelineEvent(
  physicalTimeline: PhysicalTimeline,
  simulationTimeUs: number,
): PhysicalTimelineEvent | null {
  const boundedTimeUs = clampSimulationTime(
    simulationTimeUs,
    physicalTimeline.total_duration_us,
  )
  const events = physicalTimeline.events
  const active = events.find((event) => (
    event.duration_us > 0
    && boundedTimeUs + timeToleranceUs >= event.start_us
    && boundedTimeUs < event.end_us - timeToleranceUs
  ))
  if (active) return active

  const instantaneous = events.find((event) => (
    event.duration_us === 0
    && Math.abs(boundedTimeUs - event.start_us) <= timeToleranceUs
  ))
  if (instantaneous) return instantaneous

  if (Math.abs(boundedTimeUs - physicalTimeline.total_duration_us) <= timeToleranceUs) {
    return events.at(-1) ?? null
  }
  return null
}

export function nearestTimelineSampleIndex(sampleTimesUs: number[], simulationTimeUs: number) {
  if (sampleTimesUs.length === 0) return -1
  let nearestIndex = 0
  let nearestDistance = Math.abs(sampleTimesUs[0] - simulationTimeUs)
  for (let index = 1; index < sampleTimesUs.length; index += 1) {
    const distance = Math.abs(sampleTimesUs[index] - simulationTimeUs)
    if (distance < nearestDistance) {
      nearestIndex = index
      nearestDistance = distance
    }
  }
  return nearestIndex
}

export function nearestSnapshotIndex(snapshots: StateSnapshot[], simulationTimeUs: number) {
  return nearestTimelineSampleIndex(
    snapshots.map((snapshot, index) => (
      typeof snapshot.time_us === 'number' && Number.isFinite(snapshot.time_us)
        ? snapshot.time_us
        : index
    )),
    simulationTimeUs,
  )
}
