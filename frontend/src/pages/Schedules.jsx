import Workflows from './Workflows';

// Schedules share the exact same flowchart engine as Workflows — the only
// difference is kind=SCHEDULE, which makes actions run after a delay.
export default function Schedules() {
  return <Workflows kind="SCHEDULE" />;
}