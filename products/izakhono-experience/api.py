"""Authenticated, tenant-scoped WSGI API for IZAKHONO EXPERIENCE.

Every request performs fresh ID introspection and a FORTRESS permission decision.
This module does not start a server or initialise/migrate the database.
"""
import json
import os

from domain import ExperienceError
from identity import IdentityBoundaryError, IdentityIntrospectionClient, FortressPermissionClient, authorised_experience_store

MAX_BODY_BYTES = 65536


def _json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def _public_survey(row):
    return {key: row[key] for key in ("id", "name", "metric", "status", "created_at", "updated_at")}


def _public_question(row):
    return {"id": row["id"], "position": row["position"], "kind": row["kind"],
            "prompt": row["prompt"], "required": bool(row["required"]),
            "config": json.loads(row["config_json"])}


def _public_case(row):
    return {key: row[key] for key in ("id", "response_id", "severity", "status",
            "assigned_to", "resolution_note", "created_at", "updated_at", "version")}


class ExperienceAPI:
    def __init__(self, database, *, introspect, fortress_decide):
        self.database = database
        self.introspect = introspect
        self.fortress_decide = fortress_decide

    def _response(self, start_response, status, payload):
        body = _json_bytes(payload)
        phrase = {200:"OK",201:"Created",400:"Bad Request",401:"Unauthorized",
                  403:"Forbidden",404:"Not Found",405:"Method Not Allowed",
                  413:"Payload Too Large",415:"Unsupported Media Type",
                  503:"Service Unavailable"}.get(status,"Error")
        headers = [("Content-Type","application/json; charset=utf-8"),
                   ("Content-Length",str(len(body))),("Cache-Control","no-store"),
                   ("Pragma","no-cache"),("X-Content-Type-Options","nosniff"),
                   ("Referrer-Policy","no-referrer"),("X-Frame-Options","DENY"),
                   ("Content-Security-Policy","default-src 'none'; frame-ancestors 'none'")]
        start_response(f"{status} {phrase}", headers)
        return [body]

    def _body(self, environ):
        raw_length = environ.get("CONTENT_LENGTH") or "0"
        try:
            length = int(raw_length)
        except (TypeError, ValueError):
            raise ValueError("invalid_content_length")
        if length < 0:
            raise ValueError("invalid_content_length")
        if length > MAX_BODY_BYTES:
            raise OverflowError("request_body_too_large")
        if length == 0:
            return {}
        if environ.get("CONTENT_TYPE","").split(";",1)[0].lower() != "application/json":
            raise TypeError("application_json_required")
        raw = environ["wsgi.input"].read(length)
        if len(raw) != length:
            raise ValueError("incomplete_request_body")
        value = json.loads(raw.decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("json_object_required")
        return value

    def __call__(self, environ, start_response):
        method = environ.get("REQUEST_METHOD","GET").upper()
        path = environ.get("PATH_INFO","")
        parts = [part for part in path.split("/") if part]
        routes = {
            ("GET","/api/v1/surveys"):"experience:survey:read",
            ("POST","/api/v1/surveys"):"experience:survey:write",
            ("GET","/api/v1/cases"):"experience:case:read",
        }
        permission = routes.get((method,path))
        if len(parts) == 4 and parts[:3] == ["api","v1","surveys"] and method == "GET":
            permission = "experience:survey:read"
        elif len(parts) == 5 and parts[:3] == ["api","v1","surveys"] and parts[4] == "questions" and method == "POST":
            permission = "experience:survey:write"
        elif len(parts) == 5 and parts[:3] == ["api","v1","surveys"] and parts[4] == "activate" and method == "POST":
            permission = "experience:survey:write"
        elif len(parts) == 6 and parts[:3] == ["api","v1","surveys"] and parts[4:] == ["metrics","nps"] and method == "GET":
            permission = "experience:analytics:read"
        elif len(parts) == 5 and parts[:3] == ["api","v1","cases"] and parts[4] == "transition" and method == "POST":
            permission = "experience:case:resolve"
        if permission is None:
            if path in {"/api/v1/surveys","/api/v1/cases"}:
                return self._response(start_response,405,{"error":"method_not_allowed"})
            return self._response(start_response,404,{"error":"not_found"})
        auth = environ.get("HTTP_AUTHORIZATION","")
        if not auth.startswith("Bearer ") or not auth[7:].strip():
            return self._response(start_response,401,{"error":"authentication_required"})
        try:
            store, actor = authorised_experience_store(
                self.database, bearer_token=auth[7:].strip(), permission=permission,
                introspect=self.introspect, fortress_decide=self.fortress_decide)
            body = self._body(environ) if method == "POST" else {}
            if method == "GET" and path == "/api/v1/surveys":
                return self._response(start_response,200,{"surveys":[_public_survey(row) for row in store.list_surveys()]})
            if method == "POST" and path == "/api/v1/surveys":
                if not isinstance(body.get("name"),str) or not isinstance(body.get("metric"),str):
                    raise ValueError("survey_name_and_metric_required")
                survey = store.create_survey(body["name"],metric=body["metric"],created_by=actor["subject"])
                return self._response(start_response,201,{"survey":_public_survey(survey)})
            if len(parts) == 4 and parts[:3] == ["api","v1","surveys"] and method == "GET":
                survey = store.get_survey(parts[3])
                return self._response(start_response,200,{"survey":_public_survey(survey),"questions":[_public_question(row) for row in store.list_questions(parts[3])]})
            if len(parts) == 5 and parts[:3] == ["api","v1","surveys"] and parts[4] == "questions":
                if type(body.get("position")) is not int or not isinstance(body.get("kind"),str) or not isinstance(body.get("prompt"),str):
                    raise ValueError("question_position_kind_and_prompt_required")
                if type(body.get("required",True)) is not bool or not isinstance(body.get("config",{}),dict):
                    raise ValueError("question_required_and_config_invalid")
                question = store.add_question(parts[3],position=body["position"],kind=body["kind"],prompt=body["prompt"],required=body.get("required",True),config=body.get("config",{}))
                return self._response(start_response,201,{"question":_public_question(question)})
            if len(parts) == 5 and parts[:3] == ["api","v1","surveys"] and parts[4] == "activate":
                survey = store.activate_survey(parts[3])
                return self._response(start_response,200,{"survey":_public_survey(survey)})
            if len(parts) == 6 and parts[:3] == ["api","v1","surveys"] and parts[4:] == ["metrics","nps"]:
                return self._response(start_response,200,{"nps":store.nps_summary(parts[3])})
            if method == "GET" and path == "/api/v1/cases":
                return self._response(start_response,200,{"cases":[_public_case(row) for row in store.list_cases()]})
            if len(parts) == 5 and parts[:3] == ["api","v1","cases"] and parts[4] == "transition":
                if not isinstance(body.get("status"),str) or not isinstance(body.get("resolution_note",""),str):
                    raise ValueError("case_transition_fields_invalid")
                if body.get("expected_version") is not None and type(body["expected_version"]) is not int:
                    raise ValueError("expected_version_must_be_integer")
                case = store.transition_case(parts[3],status=body["status"],actor_id=actor["subject"],resolution_note=body.get("resolution_note",""),expected_version=body.get("expected_version"))
                return self._response(start_response,200,{"case":_public_case(case)})
            return self._response(start_response,404,{"error":"not_found"})
        except IdentityBoundaryError as exc:
            message = str(exc)
            if message == "fortress_permission_denied":
                return self._response(start_response,403,{"error":"permission_denied"})
            if "unavailable" in message or "not_configured" in message or "failed" in message:
                return self._response(start_response,503,{"error":"authorisation_service_unavailable"})
            return self._response(start_response,401,{"error":"authentication_or_authorisation_failed"})
        except OverflowError:
            return self._response(start_response,413,{"error":"request_body_too_large"})
        except TypeError:
            return self._response(start_response,415,{"error":"application_json_required"})
        except (ValueError, UnicodeDecodeError):
            return self._response(start_response,400,{"error":"invalid_request"})
        except ExperienceError as exc:
            message = str(exc)
            if message.endswith("_not_found"):
                return self._response(start_response,404,{"error":"resource_not_found"})
            return self._response(start_response,400,{"error":"invalid_request","reason":message})
        except Exception:
            return self._response(start_response,503,{"error":"service_unavailable"})


def create_app(database=None, *, introspect=None, fortress_decide=None):
    """Create a WSGI app. Database schema setup is an explicit operator action."""
    db_path = database or os.getenv("IZAKHONO_EXPERIENCE_DATABASE","")
    if not db_path:
        raise RuntimeError("IZAKHONO_EXPERIENCE_DATABASE_required")
    return ExperienceAPI(db_path, introspect=introspect or IdentityIntrospectionClient(),
                         fortress_decide=fortress_decide or FortressPermissionClient())
