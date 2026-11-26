---------------------------- MODULE Work ----------------------------
(***************************************************************************)
(* Model of one Work and its Work Card going round the nine-stage loop.    *)
(*                                                                         *)
(*   grid/src/work/work-logic.ts    createWork, applyWorkOp                *)
(*   grid/src/work/work-service.ts  WorkService (membership, the version   *)
(*                                  check, the audit record)               *)
(*                                                                         *)
(* Stage 1, Enter, is membership: `member` is the set of DIDs that hold an *)
(* active Civic-DID in this Grid. Before a Work exists its stage is        *)
(* "enter".                                                                *)
(*                                                                         *)
(*   Read(a)            a reads the card and so holds its current version. *)
(*   Leave(a)           a stops being a member.                            *)
(*   Create(a, b)       a states a goal. b is the builder: a itself (only  *)
(*                      a Nous may), or another Nous that is asked.        *)
(*   Answer(a, yes)     the asked Nous accepts or declines.                *)
(*   Define(a)          for what, how, which, and the checks.              *)
(*   SetPlan(a, n)      a plan of n steps; clears an earlier approval.     *)
(*   ApprovePlan(a)     the owner approves the plan.                       *)
(*   CompleteStep(a)    the builder marks the next step done.              *)
(*   RecordCheck(a,c,r) the builder records check c as passed or failed.   *)
(*   Verify(a, yes)     another Nous confirms, or refuses and sends the    *)
(*                      Work back to Test with every result cleared.       *)
(*   Deploy(a)          the builder records where the result lives.        *)
(*   Announce(a)        the builder's notice; the Work is done.            *)
(*                                                                         *)
(* Every write names the version its author last read. The Grid applies it *)
(* only if that is still the card's version (WorkStore.replace). A write   *)
(* that is refused is no step at all: nothing changes.                     *)
(***************************************************************************)
EXTENDS Naturals, Sequences, FiniteSets

\* Persons, Nous: who can hold a Civic-DID. Outsiders never do.
\* NSteps: the longest plan. Checks: the checks a definition lists.
\* MaxOps: how many writes are applied in all (the bound).
CONSTANTS Persons, Nous, Outsiders, NoOne, NSteps, Checks, MaxOps

ASSUME Persons \cap Nous = {} /\ Outsiders \cap (Persons \cup Nous) = {}
ASSUME NoOne \notin Persons \cup Nous \cup Outsiders
ASSUME Checks # {} /\ NSteps >= 1

Everyone == Persons \cup Nous \cup Outsiders

Stages == {"enter", "goal", "define", "plan", "build", "test", "verify",
           "deploy", "notice", "done", "declined"}

\* The only moves a stage may make.
Edges == { <<"enter", "goal">>, <<"enter", "define">>,
           <<"goal", "define">>, <<"goal", "declined">>,
           <<"define", "plan">>, <<"plan", "build">>, <<"build", "test">>,
           <<"test", "verify">>, <<"verify", "deploy">>, <<"verify", "test">>,
           <<"deploy", "notice">>, <<"notice", "done">> }

VARIABLES
    member,    \* who holds an active Civic-DID now
    fresh,     \* fresh[a] = a has read the card's current version
    stage,
    version,   \* how many writes have been applied
    owner,
    builder,
    defined,   \* the definition and its checks are written
    planLen,   \* steps in the plan
    approved,  \* the owner approved the plan
    stepsDone,
    results,   \* results[c] \in {"none", "pass", "fail"}
    verifier,
    deployed,  \* the result record is written
    noticed,   \* the notice is written
    audit,     \* the work.stage_changed records: <<from, to>>
    log        \* every applied write: [op, by, base, from, to, wasMember]

vars == <<member, fresh, stage, version, owner, builder, defined, planLen, approved,
          stepsDone, results, verifier, deployed, noticed, audit, log>>

Init ==
    /\ member = Persons \cup Nous
    /\ fresh = [a \in Persons \cup Nous |-> TRUE]
    /\ stage = "enter"
    /\ version = 0
    /\ owner = NoOne
    /\ builder = NoOne
    /\ defined = FALSE
    /\ planLen = 0
    /\ approved = FALSE
    /\ stepsDone = 0
    /\ results = [c \in Checks |-> "none"]
    /\ verifier = NoOne
    /\ deployed = FALSE
    /\ noticed = FALSE
    /\ audit = <<>>
    /\ log = <<>>

\* The Grid accepts a write from a only if a is a member and read the current version.
\* The author of an applied write gets the new card back; everyone else is stale.
Accepts(a) == a \in member /\ fresh[a] /\ version < MaxOps

\* The version a's write is based on. A stale author holds some earlier version; which
\* one makes no difference, so the model uses the one just before.
BaseOf(a) == IF fresh[a] THEN version ELSE version - 1

\* An applied write: one version up, logged, and one audit record if the stage moved.
Apply(op, a, to) ==
    /\ version' = version + 1
    /\ stage' = to
    /\ log' = Append(log, [op |-> op, by |-> a, base |-> BaseOf(a), from |-> stage, to |-> to,
                         wasMember |-> a \in member])
    /\ audit' = IF to # stage THEN Append(audit, <<stage, to>>) ELSE audit
    /\ fresh' = [b \in Persons \cup Nous |-> b = a]
    /\ UNCHANGED member

Read(a) ==
    /\ a \in Persons \cup Nous
    /\ fresh' = [fresh EXCEPT ![a] = TRUE]
    /\ UNCHANGED <<member, stage, version, owner, builder, defined, planLen, approved,
                   stepsDone, results, verifier, deployed, noticed, audit, log>>

Leave(a) ==
    /\ a \in member
    /\ member' = member \ {a}
    /\ UNCHANGED <<fresh, stage, version, owner, builder, defined, planLen, approved,
                   stepsDone, results, verifier, deployed, noticed, audit, log>>

Create(a, b) ==
    /\ stage = "enter"
    /\ Accepts(a)
    /\ b \in Nous /\ b \in member
    /\ owner' = a
    /\ builder' = b
    /\ Apply("create", a, IF b = a THEN "define" ELSE "goal")
    /\ UNCHANGED <<defined, planLen, approved, stepsDone, results, verifier, deployed, noticed>>

Answer(a, yes) ==
    /\ stage = "goal"
    /\ Accepts(a)
    /\ a = builder
    /\ Apply("answer", a, IF yes THEN "define" ELSE "declined")
    /\ UNCHANGED <<owner, builder, defined, planLen, approved, stepsDone, results, verifier,
                   deployed, noticed>>

Define(a) ==
    /\ stage = "define"
    /\ Accepts(a)
    /\ a \in {owner, builder}
    /\ defined' = TRUE
    /\ Apply("define", a, "plan")
    /\ UNCHANGED <<owner, builder, planLen, approved, stepsDone, results, verifier, deployed,
                   noticed>>

SetPlan(a, n) ==
    /\ stage = "plan"
    /\ Accepts(a)
    /\ a \in {owner, builder}
    /\ planLen' = n
    /\ approved' = FALSE
    /\ Apply("set_plan", a, "plan")
    /\ UNCHANGED <<owner, builder, defined, stepsDone, results, verifier, deployed, noticed>>

ApprovePlan(a) ==
    /\ stage = "plan"
    /\ Accepts(a)
    /\ a = owner
    /\ planLen > 0
    /\ approved' = TRUE
    /\ Apply("approve_plan", a, "build")
    /\ UNCHANGED <<owner, builder, defined, planLen, stepsDone, results, verifier, deployed,
                   noticed>>

CompleteStep(a) ==
    /\ stage = "build"
    /\ Accepts(a)
    /\ a = builder
    /\ stepsDone' = stepsDone + 1
    /\ Apply("complete_step", a, IF stepsDone + 1 = planLen THEN "test" ELSE "build")
    /\ UNCHANGED <<owner, builder, defined, planLen, approved, results, verifier, deployed,
                   noticed>>

RecordCheck(a, c, r) ==
    /\ stage = "test"
    /\ Accepts(a)
    /\ a = builder
    /\ results' = [results EXCEPT ![c] = r]
    /\ Apply("record_check", a,
             IF \A d \in Checks : results'[d] = "pass" THEN "verify" ELSE "test")
    /\ UNCHANGED <<owner, builder, defined, planLen, approved, stepsDone, verifier, deployed,
                   noticed>>

Verify(a, yes) ==
    /\ stage = "verify"
    /\ Accepts(a)
    /\ a # builder
    /\ a \in Nous
    /\ IF yes
         THEN /\ verifier' = a
              /\ results' = results
              /\ Apply("verify", a, "deploy")
         ELSE /\ verifier' = verifier
              /\ results' = [c \in Checks |-> "none"]
              /\ Apply("verify", a, "test")
    /\ UNCHANGED <<owner, builder, defined, planLen, approved, stepsDone, deployed, noticed>>

Deploy(a) ==
    /\ stage = "deploy"
    /\ Accepts(a)
    /\ a = builder
    /\ deployed' = TRUE
    /\ Apply("deploy", a, "notice")
    /\ UNCHANGED <<owner, builder, defined, planLen, approved, stepsDone, results, verifier,
                   noticed>>

Announce(a) ==
    /\ stage = "notice"
    /\ Accepts(a)
    /\ a = builder
    /\ noticed' = TRUE
    /\ Apply("announce", a, "done")
    /\ UNCHANGED <<owner, builder, defined, planLen, approved, stepsDone, results, verifier,
                   deployed>>

Next ==
    \E a \in Everyone :
        \/ Read(a)
        \/ Leave(a)
        \/ \E b \in Everyone : Create(a, b)
        \/ \E yes \in BOOLEAN : Answer(a, yes)
        \/ Define(a)
        \/ \E n \in 1..NSteps : SetPlan(a, n)
        \/ ApprovePlan(a)
        \/ CompleteStep(a)
        \/ \E c \in Checks, r \in {"pass", "fail"} : RecordCheck(a, c, r)
        \/ \E yes \in BOOLEAN : Verify(a, yes)
        \/ Deploy(a)
        \/ Announce(a)

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
TypeOK ==
    /\ member \subseteq Persons \cup Nous
    /\ fresh \in [Persons \cup Nous -> BOOLEAN]
    /\ stage \in Stages
    /\ version \in 0..MaxOps
    /\ owner \in Everyone \cup {NoOne}
    /\ builder \in Everyone \cup {NoOne}
    /\ defined \in BOOLEAN /\ approved \in BOOLEAN
    /\ deployed \in BOOLEAN /\ noticed \in BOOLEAN
    /\ planLen \in 0..NSteps
    /\ stepsDone \in 0..NSteps
    /\ results \in [Checks -> {"none", "pass", "fail"}]
    /\ verifier \in Everyone \cup {NoOne}

After(s) == CASE s = "build"  -> {"build", "test", "verify", "deploy", "notice", "done"}
              [] s = "verify" -> {"verify", "deploy", "notice", "done"}
              [] s = "deploy" -> {"deploy", "notice", "done"}

\* P-WORK-01: the stage moves only along the allowed edges; done and declined never move.
\* P-WORK-07 (model part): one audit record per stage change, in order, ending at the
\* current stage.
StageEdges ==
    /\ \A i \in 1..Len(audit) : audit[i] \in Edges
    /\ Len(audit) > 0 => audit[1][1] = "enter" /\ audit[Len(audit)][2] = stage
    /\ Len(audit) = 0 => stage = "enter"
    /\ \A i \in 1..(Len(audit) - 1) : audit[i][2] = audit[i + 1][1]

\* P-WORK-02: no building before the checks are written and the plan is approved.
BuildNeedsChecksAndPlan ==
    stage \in After("build") => defined /\ approved /\ planLen > 0

\* P-WORK-03: no verifying before every step is done and every check has passed.
VerifyNeedsAllPassed ==
    stage \in After("verify") =>
        /\ stepsDone = planLen
        /\ \A c \in Checks : results[c] = "pass"

\* P-WORK-04: a deployed Work was confirmed by a Nous that is not its builder.
VerifierNotBuilder ==
    /\ verifier # NoOne => verifier # builder /\ verifier \in Nous
    /\ stage \in After("deploy") => verifier # NoOne

\* P-WORK-05: the builder is a Nous, never a person.
BuilderIsNous ==
    stage # "enter" => builder \in Nous

\* P-WORK-06: every applied write came from someone who was a member when it was made,
\* in the role its operation allows.
RoleOf(e) ==
    CASE e.op = "create"        -> TRUE
      [] e.op = "answer"        -> e.by = builder
      [] e.op = "define"        -> e.by \in {owner, builder}
      [] e.op = "set_plan"      -> e.by \in {owner, builder}
      [] e.op = "approve_plan"  -> e.by = owner
      [] e.op = "complete_step" -> e.by = builder
      [] e.op = "record_check"  -> e.by = builder
      [] e.op = "verify"        -> e.by # builder /\ e.by \in Nous
      [] e.op = "deploy"        -> e.by = builder
      [] e.op = "announce"      -> e.by = builder
OnlyByRole ==
    \A i \in 1..Len(log) : RoleOf(log[i]) /\ log[i].wasMember

\* P-WORK-08: every applied write was based on the version just before it, so no two
\* writes were applied on top of the same version and none is lost.
\* P-NOUSWORK-03: a Nous's Brain is one of these actors. Its cycle Reads the card, then
\* sends one write on what it read; a card that moved meanwhile refuses it.
NoLostWrite ==
    /\ version = Len(log)
    /\ \A i \in 1..Len(log) : log[i].base = i - 1

\* P-WORK-09: a done Work has its result record and its notice.
DoneIsComplete ==
    /\ stage \in {"notice", "done"} => deployed
    /\ stage = "done" => noticed
=============================================================================
