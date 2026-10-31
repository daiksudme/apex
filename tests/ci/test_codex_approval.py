"""Exercise the workflow's approval script with an isolated GitHub API double."""

import contextlib
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest
from unittest.mock import patch


WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/approve-codex-review.yml"
HEAD = "b1b939347652fcd3678578e28d0282c9a1f0e33d"
ROOT = "repos/daiksudme/apex"
BOT = {"login": "chatgpt-codex-connector[bot]", "id": 199175422, "type": "Bot"}
APP = {"id": 1144995, "slug": "chatgpt-codex-connector"}


def comment(number, body, created, updated=None, trusted=True):
    return {
        "id": number,
        "body": body,
        "created_at": created,
        "updated_at": updated or created,
        "user": copy.deepcopy(BOT) if trusted else {"login": "daiksud", "id": 155234749},
        "performed_via_github_app": copy.deepcopy(APP) if trusted else None,
    }


def fixture():
    state = {
        "code_review": {"commit_sha": HEAD, "status": "completed", "has_any_findings": False, "has_unresolved_findings": False},
        "security_review": {"commit_sha": HEAD, "status": "completed", "has_any_findings": None, "has_unresolved_findings": None},
    }
    metadata = {"headSha": HEAD, "repository": "daiksudme/apex", "pullRequestNumber": 200, "status": "completed", "mergeGateEnabled": False}
    summary = "\n".join([
        "<!-- codex-pull-request-review-summary -->",
        f"<!-- codex-review-state:v1 {json.dumps(state)} -->",
        f"<!-- codex-security-review:v1 {json.dumps(metadata)} -->",
        f'| **Code Review** | **Completed** <relative-time datetime="2026-10-31T11:31:06.5Z">done</relative-time> | `{HEAD[:7]}` | Manual request |',
        f'| **Security Review** | **Completed** <relative-time datetime="2026-10-31T11:32:31.5Z">done</relative-time> | `{HEAD[:7]}` | Manual request |',
    ])
    receipt = "<!-- codex-review-receipt:v1 -->\n\n{}\n\n**Reviewed commit:** `" + HEAD[:10] + "`\n"
    return {
        "pr": {"state": "open", "head": {"sha": HEAD}, "base": {"ref": "main", "sha": "a" * 40}},
        "comments": [
            comment(1, "@codex review", "2026-10-31T11:30:17Z", trusted=False),
            comment(2, summary, "2026-10-31T11:30:33Z", "2026-10-31T11:32:33Z"),
            comment(3, receipt.format("Codex Review: Didn't find any major issues."), "2026-10-31T11:31:06Z"),
            comment(4, receipt.format("### 🛡️ Codex Security Review · _Automatically triggered_\n\nSecurity review completed. No security issues were found in this pull request."), "2026-10-31T11:32:31Z"),
        ],
        "timeline": [],
        "reactions": [{"id": 10, "user": {**BOT, "type": "User"}, "content": "+1", "created_at": "2026-10-31T11:32:35Z"}],
        "reviews": [],
        "resolved_sha": HEAD,
    }


def execute(data, before_read=None, fail_api=False, with_summary=True):
    """Run the actual entry point; intercept every external process, including sleep."""
    workflow = WORKFLOW.read_text(encoding="utf-8")
    source = textwrap.dedent(workflow.split("python3 - <<'PYTHON'\n", 1)[1].rsplit("\n          PYTHON", 1)[0])
    writes, reads = [], {}
    stdout, stderr = io.StringIO(), io.StringIO()

    def process(args, **kwargs):
        if args == ["sleep", "30"]:
            return subprocess.CompletedProcess(args, 0)
        if args[:2] != ["gh", "api"]:
            raise AssertionError(f"Unexpected external command: {args!r}")
        if fail_api:
            return subprocess.CompletedProcess(args, 1, "private API response", "secret credential")
        if args[2:4] == ["--method", "POST"]:
            writes.append(args)
            return subprocess.CompletedProcess(args, 0, json.dumps({"state": "APPROVED", "commit_id": HEAD}))
        endpoint = args[2].split("?", 1)[0]
        reads[endpoint] = reads.get(endpoint, 0) + 1
        if before_read:
            before_read(endpoint, reads[endpoint], data)
        responses = {
            f"{ROOT}/pulls/200": data["pr"],
            f"{ROOT}/issues/200/comments": data["comments"],
            f"{ROOT}/issues/200/timeline": data["timeline"],
            f"{ROOT}/issues/200/reactions": data["reactions"],
            f"{ROOT}/pulls/200/reviews": data["reviews"],
            f"{ROOT}/commits/{HEAD[:10]}": {"sha": data["resolved_sha"]},
        }
        value = responses[endpoint]
        return subprocess.CompletedProcess(args, 0, json.dumps([value] if "--slurp" in args else value))

    with tempfile.TemporaryDirectory() as directory:
        summary_path = Path(directory) / "summary.md"
        env = {"GITHUB_REPOSITORY": "daiksudme/apex", "PR_NUMBER": "200", "COMMENT_ID": "2"}
        if with_summary:
            env["GITHUB_STEP_SUMMARY"] = str(summary_path)
        with patch.dict(os.environ, env, clear=True), patch("subprocess.run", side_effect=process), contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = 0
            try:
                exec(compile(source, str(WORKFLOW), "exec"), {"__name__": "__main__"})
            except SystemExit as error:
                code = error.code
        summary = summary_path.read_text(encoding="utf-8") if summary_path.exists() else ""
    return {"code": code, "writes": writes, "stdout": stdout.getvalue(), "stderr": stderr.getvalue(), "summary": summary}


class CodexApprovalTests(unittest.TestCase):
    def assert_approved(self, result):
        self.assertEqual(result["code"], 0, result)
        self.assertEqual(len(result["writes"]), 1, result)
        self.assertEqual(result["writes"][0], ["gh", "api", "--method", "POST", f"{ROOT}/pulls/200/reviews", "-f", "event=APPROVE", "-f", f"commit_id={HEAD}"])
        self.assertIn("Approved", result["summary"])
        self.assertIn(HEAD, result["summary"])

    def assert_withheld(self, result, reason=None):
        self.assertEqual(result["code"], 0, result)
        self.assertEqual(result["writes"], [], result)
        self.assertIn("::warning title=Codex approval withheld::", result["stdout"])
        self.assertIn("Withheld", result["summary"])
        self.assertIn("No approval was submitted", result["summary"])
        if reason:
            self.assertIn(reason, result["summary"])

    def test_plain_request_still_approves_current_commit(self):
        self.assert_approved(execute(fixture()))

    def test_first_line_command_allows_explanation(self):
        for body in ["@codex review\n\nPlease review the current HEAD and the tests.", "  @CODEX REVIEW \r\nPlease review the current HEAD."]:
            with self.subTest(body=body):
                data = fixture()
                data["comments"][0]["body"] = body
                self.assert_approved(execute(data))

    def test_non_command_first_lines_are_not_review_boundaries(self):
        for body in ["", "\n@codex review", "Please check this.\n@codex review", "> @codex review", "```\n@codex review\n```", "@codex review please", "@codex security review"]:
            with self.subTest(body=body):
                data = fixture()
                data["comments"][0]["body"] = body
                self.assert_withheld(execute(data))

    def test_edited_request_is_withheld(self):
        data = fixture()
        data["comments"][0].update(body="@codex review\nExplanation", updated_at="2026-10-31T11:30:18Z")
        self.assert_withheld(execute(data), "unedited")

    def test_explanation_is_accepted_after_base_retarget(self):
        data = fixture()
        data["comments"][0]["body"] = "@codex review\nPlease review after retargeting."
        data["timeline"] = [{"id": 20, "event": "base_ref_changed", "created_at": "2026-10-31T11:30:00Z"}]
        self.assert_approved(execute(data))

    def test_base_retarget_after_request_is_withheld(self):
        data = fixture()
        data["comments"][0]["body"] = "@codex review\nExplanation"
        data["timeline"] = [{"id": 20, "event": "base_ref_changed", "created_at": "2026-10-31T11:30:20Z"}]
        self.assert_withheld(execute(data), "base changed")

    def test_edited_request_after_retarget_is_withheld(self):
        data = fixture()
        data["comments"][0]["updated_at"] = "2026-10-31T11:30:18Z"
        data["timeline"] = [{"id": 20, "event": "base_ref_changed", "created_at": "2026-10-31T11:30:00Z"}]
        self.assert_withheld(execute(data), "unedited")

    def test_stale_missing_and_same_second_thumbs_up_are_withheld(self):
        for time in [None, "2026-10-31T11:32:32Z", "2026-10-31T11:32:33Z"]:
            with self.subTest(time=time):
                data = fixture()
                if time:
                    data["reactions"][0]["created_at"] = time
                else:
                    data["reactions"] = []
                self.assert_withheld(execute(data), "no fresh Codex thumbs-up")

    def test_untrusted_summary_identity_or_app_is_withheld(self):
        for field in ["user", "performed_via_github_app"]:
            with self.subTest(field=field):
                data = fixture()
                data["comments"][1][field]["id"] = 1
                self.assert_withheld(execute(data), "no trusted review summary")

    def test_untrusted_thumbs_up_is_withheld(self):
        data = fixture()
        data["reactions"][0]["user"]["id"] = 1
        self.assert_withheld(execute(data), "no fresh Codex thumbs-up")

    def test_incomplete_reviews_wrong_head_and_findings_are_withheld(self):
        for old, new in [('"status": "completed"', '"status": "in_progress"'), (HEAD, "b" * 40), ('"has_unresolved_findings": false', '"has_unresolved_findings": true'), ('"has_any_findings": null', '"has_any_findings": true')]:
            with self.subTest(new=new):
                data = fixture()
                data["comments"][1]["body"] = data["comments"][1]["body"].replace(old, new)
                self.assert_withheld(execute(data))

    def test_receipts_must_be_present_unedited_and_match_head(self):
        for kind in ["missing", "edited", "wrong_sha", "untrusted", "wrong_resolution"]:
            with self.subTest(kind=kind):
                data = fixture()
                if kind == "missing":
                    data["comments"].pop()
                elif kind == "edited":
                    data["comments"][-1]["updated_at"] = "2026-10-31T11:32:32Z"
                elif kind == "wrong_sha":
                    data["comments"][-1]["body"] = data["comments"][-1]["body"].replace(HEAD[:10], "b" * 10)
                elif kind == "untrusted":
                    data["comments"][-1]["performed_via_github_app"]["id"] = 1
                else:
                    data["resolved_sha"] = "b" * 40
                self.assert_withheld(execute(data))

    def test_newer_or_overlapping_requests_are_withheld(self):
        for created in ["2026-10-31T11:30:20Z", "2026-10-31T11:32:34Z"]:
            with self.subTest(created=created):
                data = fixture()
                data["comments"].append(comment(5, "@codex review\nRetry", created, trusted=False))
                self.assert_withheld(execute(data))

    def test_requested_changes_are_not_overridden(self):
        data = fixture()
        data["reviews"] = [{"user": {"login": "reviewer"}, "state": "CHANGES_REQUESTED", "commit_id": HEAD}]
        self.assert_withheld(execute(data), "requested changes")

    def test_evidence_is_rechecked_before_approval(self):
        def change(endpoint, count, data):
            if endpoint.endswith("/comments") and count == 2:
                data["comments"][1]["body"] += "\nUpdated explanation"
        self.assert_withheld(execute(fixture(), before_read=change), "evidence changed")

    def test_head_base_and_open_state_are_rechecked_before_approval(self):
        for field in ["head", "base", "state"]:
            with self.subTest(field=field):
                def change(endpoint, count, data):
                    if endpoint == f"{ROOT}/pulls/200" and count == 2:
                        if field == "state":
                            data["pr"][field] = "closed"
                        else:
                            data["pr"][field]["sha"] = "c" * 40
                self.assert_withheld(execute(fixture(), before_read=change), "before approval")

    def test_thumbs_up_is_rechecked_before_approval(self):
        def change(endpoint, count, data):
            if endpoint.endswith("/reactions") and count == 2:
                data["reactions"][0]["id"] = 11
        self.assert_withheld(execute(fixture(), before_read=change), "thumbs-up changed")

    def test_existing_approval_is_reported_without_another_write(self):
        data = fixture()
        data["reviews"] = [{"user": {"login": "github-actions[bot]"}, "state": "APPROVED", "commit_id": HEAD}]
        result = execute(data)
        self.assertEqual(result["code"], 0, result)
        self.assertEqual(result["writes"], [])
        self.assertIn("Already approved", result["summary"])
        self.assertIn(HEAD, result["summary"])

    def test_api_failure_remains_a_failure_without_leaking_data(self):
        result = execute(fixture(), fail_api=True)
        self.assertEqual(result["code"], 1, result)
        self.assertEqual(result["writes"], [])
        self.assertIn("Failed", result["summary"])
        output = result["summary"] + result["stdout"] + result["stderr"]
        self.assertNotIn("private API response", output)
        self.assertNotIn("secret credential", output)

    def test_untrusted_request_text_is_not_echoed(self):
        data = fixture()
        data["comments"][0]["body"] = "@codex review private-comment-text\n::error::injected"
        result = execute(data)
        self.assert_withheld(result)
        output = result["summary"] + result["stdout"] + result["stderr"]
        self.assertNotIn("private-comment-text", output)
        self.assertNotIn("::error::injected", output)

    def test_missing_summary_environment_does_not_change_approval(self):
        result = execute(fixture(), with_summary=False)
        self.assertEqual(result["code"], 0, result)
        self.assertEqual(len(result["writes"]), 1, result)


if __name__ == "__main__":
    unittest.main()
