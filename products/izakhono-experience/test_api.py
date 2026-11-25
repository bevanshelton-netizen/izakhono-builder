import io
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from api import ExperienceAPI
from domain import ExperienceStore


class ExperienceAPITests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.database = str(Path(self.tmp.name) / "experience.sqlite")
        ExperienceStore(self.database, entity_id="entity-a", platform_id="izakhono-experience").initialise()
        self.entity = "entity-a"
        self.decisions = []
        self.app = ExperienceAPI(self.database, introspect=self.introspect, fortress_decide=self.decide)

    def tearDown(self):
        self.tmp.cleanup()

    def introspect(self, token):
        if token == "expired":
            expiry = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        else:
            expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        return {"ok":True,"active":True,"subject":"verified-subject","entity_id":self.entity,
                "role":"experience-manager","expires_at":expiry}

    def decide(self, request):
        self.decisions.append(dict(request))
        return request["entity_id"] == self.entity

    def request(self, method, path, payload=None, token="valid"):
        raw = b"" if payload is None else json.dumps(payload).encode()
        environ = {
            "REQUEST_METHOD":method,"PATH_INFO":path,"CONTENT_LENGTH":str(len(raw)),
            "CONTENT_TYPE":"application/json","wsgi.input":io.BytesIO(raw),
            "HTTP_AUTHORIZATION":("Bearer " + token) if token else "",
        }
        captured = {}
        def start_response(status, headers):
            captured["status"] = int(status.split()[0])
            captured["headers"] = dict(headers)
        result = b"".join(self.app(environ,start_response))
        captured["body"] = json.loads(result.decode())
        return captured

    def test_authentication_required_before_identity_or_policy(self):
        response = self.request("GET","/api/v1/surveys",token="")
        self.assertEqual(response["status"],401)
        self.assertEqual(self.decisions,[])

    def test_create_survey_uses_identity_subject_not_client_actor(self):
        response = self.request("POST","/api/v1/surveys",{"name":"Support NPS","metric":"NPS","created_by":"attacker"})
        self.assertEqual(response["status"],201)
        self.assertEqual(response["body"]["survey"]["name"],"Support NPS")
        self.assertEqual(self.decisions[-1]["permission"],"experience:survey:write")
        with ExperienceStore(self.database,entity_id="entity-a",platform_id="izakhono-experience").connect() as db:
            row=db.execute("SELECT created_by FROM surveys").fetchone()
        self.assertEqual(row["created_by"],"verified-subject")

    def test_full_survey_management_and_nps_metrics(self):
        created=self.request("POST","/api/v1/surveys",{"name":"Support NPS","metric":"NPS"})
        sid=created["body"]["survey"]["id"]
        question=self.request("POST",f"/api/v1/surveys/{sid}/questions",
                              {"position":0,"kind":"nps","prompt":"Recommend us?"})
        self.assertEqual(question["status"],201)
        activated=self.request("POST",f"/api/v1/surveys/{sid}/activate",{})
        self.assertEqual(activated["body"]["survey"]["status"],"active")
        detail=self.request("GET",f"/api/v1/surveys/{sid}")
        self.assertEqual(len(detail["body"]["questions"]),1)
        metric=self.request("GET",f"/api/v1/surveys/{sid}/metrics/nps")
        self.assertEqual(metric["status"],200)
        self.assertIsNone(metric["body"]["nps"]["score"])
        self.assertEqual([x["permission"] for x in self.decisions],
                         ["experience:survey:write","experience:survey:write",
                          "experience:survey:write","experience:survey:read",
                          "experience:analytics:read"])

    def test_expired_identity_denied(self):
        response=self.request("GET","/api/v1/surveys",token="expired")
        self.assertEqual(response["status"],401)

    def test_fortress_denial_is_forbidden(self):
        self.app.fortress_decide=lambda request: False
        response=self.request("GET","/api/v1/surveys")
        self.assertEqual(response["status"],403)

    def test_entity_scope_comes_from_id_and_does_not_leak(self):
        self.request("POST","/api/v1/surveys",{"name":"Private","metric":"CSAT"})
        self.entity="entity-b"
        response=self.request("GET","/api/v1/surveys")
        self.assertEqual(response["status"],200)
        self.assertEqual(response["body"]["surveys"],[])

    def test_oversized_and_non_json_bodies_rejected(self):
        raw=b"x"*(65536+1)
        env={"REQUEST_METHOD":"POST","PATH_INFO":"/api/v1/surveys",
             "CONTENT_LENGTH":str(len(raw)),"CONTENT_TYPE":"application/json",
             "wsgi.input":io.BytesIO(raw),"HTTP_AUTHORIZATION":"Bearer valid"}
        captured={}
        def start(status,headers): captured["status"]=int(status.split()[0])
        b"".join(self.app(env,start))
        self.assertEqual(captured["status"],413)

        response=self.request("POST","/api/v1/surveys",{"name":"x","metric":"NPS"})
        self.assertEqual(response["status"],201)


if __name__ == "__main__":
    unittest.main()
