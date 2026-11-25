import tempfile
import unittest
from pathlib import Path
from domain import ExperienceError, ExperienceStore, calculate_nps

class ExperienceTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(); self.db=Path(self.tmp.name)/"experience.db"
  self.a=ExperienceStore(self.db,entity_id="entity-a",platform_id="platform-a")
  self.b=ExperienceStore(self.db,entity_id="entity-b",platform_id="platform-a"); self.a.initialise()
 def tearDown(self): self.tmp.cleanup()
 def survey(self):
  s=self.a.create_survey("Support NPS",metric="NPS",created_by="owner")
  q=self.a.add_question(s["id"],position=0,kind="nps",prompt="Recommend us?")
  self.a.activate_survey(s["id"]); return s,q
 def test_nps_standard(self):
  r=calculate_nps([10,9,8,7,6,0]); self.assertEqual(r["score"],0); self.assertEqual((r["promoters"],r["passives"],r["detractors"]),(2,2,2))
 def test_nps_empty_and_invalid(self):
  self.assertIsNone(calculate_nps([])["score"])
  with self.assertRaises(ExperienceError): calculate_nps([11])
  with self.assertRaises(ExperienceError): calculate_nps([True])
 def test_response_and_summary(self):
  s,q=self.survey(); self.a.submit_response(s["id"],{q["id"]:10}); self.a.submit_response(s["id"],{q["id"]:5})
  self.assertEqual(self.a.nps_summary(s["id"])["score"],0)
 def test_anonymous_reference_not_persisted(self):
  s,q=self.survey()
  with self.assertRaises(ExperienceError): self.a.submit_response(s["id"],{q["id"]:9},respondent_ref="person")
  rid=self.a.submit_response(s["id"],{q["id"]:9})["id"]
  with self.a.connect() as db: self.assertIsNone(db.execute("SELECT respondent_ref FROM responses WHERE id=?",(rid,)).fetchone()[0])
 def test_cross_tenant_reads_and_writes_denied(self):
  s,q=self.survey(); rid=self.a.submit_response(s["id"],{q["id"]:1})["id"]
  with self.assertRaises(ExperienceError): self.b.get_survey(s["id"])
  with self.assertRaises(ExperienceError): self.b.open_case(rid)
  with self.assertRaises(ExperienceError): self.b.submit_response(s["id"],{q["id"]:3})
 def test_required_answers_and_edit_lock(self):
  s,q=self.survey()
  with self.assertRaises(ExperienceError): self.a.submit_response(s["id"],{})
  with self.assertRaises(ExperienceError): self.a.add_question(s["id"],position=1,kind="text",prompt="Why?")
 def test_case_lifecycle(self):
  s,q=self.survey(); rid=self.a.submit_response(s["id"],{q["id"]:2})["id"]; c=self.a.open_case(rid,severity="high")
  c=self.a.transition_case(c["id"],status="acknowledged",actor_id="agent")
  c=self.a.transition_case(c["id"],status="in_progress",actor_id="agent")
  with self.assertRaises(ExperienceError): self.a.transition_case(c["id"],status="resolved",actor_id="agent")
  c=self.a.transition_case(c["id"],status="resolved",actor_id="agent",resolution_note="Corrected")
  self.assertEqual(c["status"],"resolved")
 def test_rating_and_choice_validation(self):
  s=self.a.create_survey("CSAT",metric="CSAT",created_by="owner")
  r=self.a.add_question(s["id"],position=0,kind="rating",prompt="Rate",config={"min":1,"max":5})
  c=self.a.add_question(s["id"],position=1,kind="choice",prompt="Channel",config={"choices":["email","phone"]})
  self.a.activate_survey(s["id"])
  with self.assertRaises(ExperienceError): self.a.submit_response(s["id"],{r["id"]:6,c["id"]:"email"})
  with self.assertRaises(ExperienceError): self.a.submit_response(s["id"],{r["id"]:4,c["id"]:"other"})
  self.a.submit_response(s["id"],{r["id"]:4,c["id"]:"email"})


 def test_case_history_is_append_only_and_actor_attributed(self):
  s,q=self.survey(); rid=self.a.submit_response(s["id"],{q["id"]:2})["id"]
  c=self.a.open_case(rid,actor_id="operator-1")
  c=self.a.transition_case(c["id"],status="acknowledged",actor_id="operator-2",expected_version=1)
  c=self.a.transition_case(c["id"],status="in_progress",actor_id="agent-7",expected_version=2)
  history=self.a.case_history(c["id"])
  self.assertEqual([e["to_status"] for e in history],["open","acknowledged","in_progress"])
  self.assertEqual([e["actor_id"] for e in history],["operator-1","operator-2","agent-7"])
  self.assertEqual([e["version"] for e in history],[1,2,3])
  with self.assertRaises(ExperienceError): self.b.case_history(c["id"])
 def test_case_transition_rejects_stale_version(self):
  s,q=self.survey(); rid=self.a.submit_response(s["id"],{q["id"]:2})["id"]
  c=self.a.open_case(rid)
  updated=self.a.transition_case(c["id"],status="acknowledged",actor_id="operator",expected_version=1)
  self.assertEqual(updated["version"],2)
  with self.assertRaisesRegex(ExperienceError,"stale_case_version"):
   self.a.transition_case(c["id"],status="in_progress",actor_id="other-operator",expected_version=1)
  self.assertEqual(self.a.case_history(c["id"])[-1]["to_status"],"acknowledged")
 def test_case_creation_idempotency_and_payload_conflict(self):
  s,q=self.survey(); rid=self.a.submit_response(s["id"],{q["id"]:2})["id"]
  first=self.a.open_case(rid,severity="high",actor_id="operator",idempotency_key="request-123")
  retry=self.a.open_case(rid,severity="high",actor_id="operator",idempotency_key="request-123")
  self.assertEqual(first["id"],retry["id"])
  self.assertEqual(len(self.a.case_history(first["id"])),1)
  with self.assertRaisesRegex(ExperienceError,"idempotency_key_reused_with_different_request"):
   self.a.open_case(rid,severity="urgent",actor_id="operator",idempotency_key="request-123")

if __name__=="__main__": unittest.main()
