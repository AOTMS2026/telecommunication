import { useParams } from 'react-router-dom';
import LeadDetailsPage from '../components/LeadDetails/LeadDetailsPage';

// Route: /leads/:id
// Thin wrapper — all the real lead-detail UI/logic now lives in the shared
// LeadDetailsPage component (components/LeadDetails/LeadDetailsPage.jsx) so
// the Leads page and the Campaign page render the exact same component.
export default function LeadProfile() {
  const { id } = useParams();
  return <LeadDetailsPage leadId={id} />;
}