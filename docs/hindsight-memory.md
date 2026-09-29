# Hindsight memory workflow

RecruitMind uses the official Hindsight memory REST operations. It does not substitute an in-process list or a database query for Hindsight.

## What is retained

After a recruiter chooses shortlist, maybe, or reject, the service submits a concise event containing the role title, decision, candidate's extracted skills, and the recruiter-provided rationale. Resume text, contact data, and protected attributes are not included in the retained content. The event context identifies it as a recruitment decision for that role.

## When memory is retained

The decision and rationale are first committed to application storage. The service then posts the decision event to the configured Hindsight bank. A Hindsight error is returned clearly; the decision remains saved, and the response indicates that retention failed. When no Hindsight URL is configured, the application tells the recruiter that this decision was not persisted as memory.

## How memory is recalled

Before evaluating a candidate, the API builds a query from role title, required skills, and extracted candidate skills, then calls Hindsight `POST /v1/default/banks/{bank_id}/memories/recall`. Up to eight returned facts are attached to the evaluation response and displayed in the Memory Impact view.

## How recall informs the review

When configured, the OpenAI-compatible structured evaluator receives job-related resume evidence and recalled Hindsight memories together. It is instructed to use memories as historical recruiter context, not facts about the current candidate, and not to override contradictory resume evidence. Its output is schema-validated and matched skills are restricted to the role's listed skills. If the provider is not configured or returns invalid output, transparent evidence rules provide a labeled fallback. The UI identifies the evaluation method and the Memory Impact page displays the recalled facts separately.

## Learning over interactions

Recruiter rationale is the meaningful feedback signal. Hindsight can extract experiences and patterns from retained decisions; later role evaluations recall those facts. Recruiters remain responsible for decisions, and memory must only express job-related preferences supported by explicit feedback. Review and deletion controls, retention policies, and tenant isolation are required before production use.

Official references: [Hindsight API quick start](https://hindsight.vectorize.io/developer/api/quickstart), [retain](https://docs.hindsight.vectorize.io/retain/), and [recall API](https://docs.hindsight.vectorize.io/api-reference/recall-memories/).
