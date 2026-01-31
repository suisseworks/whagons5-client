import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook,
  faCheckCircle,
  faCircleQuestion,
  faClock,
  faExclamationTriangle,
  faInfoCircle,
  faLock,
  faSquareCheck,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const ApprovalsHelpTab = () => {
  return (
    <div className="h-full min-h-0 overflow-y-auto p-6 space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <FontAwesomeIcon icon={faBook} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Approvals Documentation</h1>
            <p className="text-muted-foreground mt-1">Complete guide to configuring and using task approvals</p>
          </div>
        </div>
      </div>

      {/* Overview Section */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <FontAwesomeIcon icon={faInfoCircle} className="w-5 h-5" />
            What are Approvals?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-foreground">
            Approvals allow you to require specific users or roles to review and approve tasks before they can proceed. This ensures
            proper oversight and control over critical operations.
          </p>
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <div className="p-3 bg-white dark:bg-gray-900 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Use Cases</div>
              <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside">
                <li>Expense approvals</li>
                <li>Work order authorization</li>
                <li>Policy compliance checks</li>
                <li>Quality control reviews</li>
                <li>Budget approvals</li>
              </ul>
            </div>
            <div className="p-3 bg-white dark:bg-gray-900 rounded-md border border-blue-200 dark:border-blue-800">
              <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Benefits</div>
              <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside">
                <li>Enforce business rules</li>
                <li>Maintain audit trails</li>
                <li>Prevent unauthorized actions</li>
                <li>Ensure compliance</li>
                <li>Improve accountability</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5" />
            Quick Start Guide
          </CardTitle>
          <CardDescription>Follow these steps to set up your first approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                1
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground mb-1">Create Approval Configuration</div>
                <p className="text-sm text-muted-foreground">
                  Click <Badge variant="outline" className="mx-1">Add Approval</Badge> and fill in the General tab with a name and
                  description. Then configure the Rules tab with your approval type, trigger, and requirements.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                2
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground mb-1">Assign Approvers</div>
                <p className="text-sm text-muted-foreground">
                  Click the <Badge variant="outline" className="mx-1">Approvers</Badge> button in the Actions column. Add users or roles
                  who can approve tasks. You can mark approvers as required or optional.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                3
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground mb-1">Assign to Category or Template</div>
                <p className="text-sm text-muted-foreground">
                  Go to <Badge variant="outline" className="mx-1">Settings → Categories</Badge> or{" "}
                  <Badge variant="outline" className="mx-1">Settings → Templates</Badge> and assign your approval to the appropriate
                  category or template. Tasks created with that category/template will require approval.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                4
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground mb-1">Create Tasks</div>
                <p className="text-sm text-muted-foreground">
                  When you create a task with the assigned category or template, the approval workflow will automatically start (if
                  trigger is set to &quot;ON_CREATE&quot;) or can be triggered manually.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Approval Types</CardTitle>
          <CardDescription>Choose how approvers review tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-600">S</Badge>
                <span className="font-semibold text-foreground">Sequential</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Approvers review tasks one after another in order. Each approver must complete their review before the next one can begin.
              </p>
              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Best for:</div>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li>Hierarchical approval chains</li>
                <li>Department → Manager → Director</li>
                <li>When order matters</li>
              </ul>
            </div>

            <div className="p-4 border-2 border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-600">P</Badge>
                <span className="font-semibold text-foreground">Parallel</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                All approvers can review simultaneously. The approval completes when the required number of approvals is reached.
              </p>
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Best for:</div>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li>Team-based approvals</li>
                <li>Multiple stakeholders</li>
                <li>Faster turnaround needed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trigger Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Trigger Types</CardTitle>
          <CardDescription>When should the approval workflow start?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-foreground">ON_CREATE</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Approval workflow starts automatically when a task is created with the assigned category or template. This is the most common
                trigger type.
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-foreground">MANUAL</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Approval must be started manually by a user with appropriate permissions. Useful when you want to control exactly when approvals begin.
              </p>
            </div>

            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-foreground">CONDITIONAL</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Approval starts when specific conditions are met. You can configure conditions based on task fields or custom fields.
              </p>
              <div className="text-xs text-muted-foreground bg-background p-2 rounded border">
                <strong>Example:</strong> Start approval when task status equals &quot;Pending Review&quot; or when a custom field &quot;Amount&quot; is greater than $1000.
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-foreground">ON_COMPLETE</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Approval is triggered when a task transitions to a finished/completed status. Useful for QA sign-off, deliverable acceptance, or supervisor verification before final completion.
              </p>
              <div className="text-xs text-muted-foreground bg-background p-2 rounded border">
                <strong>Example:</strong> Require manager approval before a task can be marked as Done. The task will remain in &quot;pending approval&quot; state until approved.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Approval Statuses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Approval Statuses</CardTitle>
          <CardDescription>Understanding task approval states</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  pending
                </Badge>
                <span className="font-medium text-foreground">Pending</span>
              </div>
              <p className="text-xs text-muted-foreground">Waiting for approver(s) to review</p>
            </div>

            <div className="p-3 border rounded-lg bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  approved
                </Badge>
                <span className="font-medium text-foreground">Approved</span>
              </div>
              <p className="text-xs text-muted-foreground">All required approvers have approved</p>
            </div>

            <div className="p-3 border rounded-lg bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                  rejected
                </Badge>
                <span className="font-medium text-foreground">Rejected</span>
              </div>
              <p className="text-xs text-muted-foreground">One or more approvers rejected the task</p>
            </div>

            <div className="p-3 border rounded-lg bg-gray-50/50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">
                  cancelled
                </Badge>
                <span className="font-medium text-foreground">Cancelled</span>
              </div>
              <p className="text-xs text-muted-foreground">Approval workflow was cancelled</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Configuration Options</CardTitle>
          <CardDescription>Fine-tune your approval workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-3 border rounded-lg">
              <div className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <FontAwesomeIcon icon={faUsers} className="w-4 h-4 text-blue-600" />
                Require All Approvers
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, all assigned approvers must approve. When disabled, you can set a minimum number of approvals required (useful
                for parallel approvals).
              </p>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 text-red-600" />
                Require Rejection Comment
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, approvers must provide a comment explaining why they rejected the task. This helps maintain clear communication and
                audit trails.
              </p>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <FontAwesomeIcon icon={faLock} className="w-4 h-4 text-amber-600" />
                Block Editing During Approval
              </div>
              <p className="text-sm text-muted-foreground">
                Prevents task modifications while approval is pending. This ensures approvers review the exact task state and prevents mid-review changes.
              </p>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="font-semibold text-foreground mb-1 flex items-center gap-2">
                <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-purple-600" />
                Deadline
              </div>
              <p className="text-sm text-muted-foreground">
                Set a deadline for approval completion. Can be specified in hours (e.g., 24 hours) or as a specific date. Helps ensure timely reviews.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assigning Approvals */}
      <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
            <FontAwesomeIcon icon={faSquareCheck} className="w-5 h-5" />
            Assigning Approvals to Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                <Badge className="bg-purple-600">Option 1</Badge>
                Category-Based Approval
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Assign an approval to a category. All tasks created with that category will require approval.
              </p>
              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                <strong>Steps:</strong> Settings → Categories → Edit Category → Select Approval → Save
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                <Badge className="bg-purple-600">Option 2</Badge>
                Template-Based Approval
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Assign an approval to a template. Tasks created from that template will require approval.
              </p>
              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                <strong>Steps:</strong> Settings → Templates → Edit Template → Rules Tab → Select Approval → Save
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">💡 Tip</div>
              <p className="text-xs text-muted-foreground">
                If both category and template have approvals assigned, the template&apos;s approval typically takes precedence.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Example Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Example: AC Repair Approval</CardTitle>
          <CardDescription>Complete walkthrough for setting up an approval workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                1
              </div>
              <div>
                <strong className="text-foreground">Create Approval:</strong> Name it &quot;Manager Approval for AC Repairs&quot;, set type to
                Sequential, trigger to ON_CREATE, and enable &quot;Require all approvers&quot;.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                2
              </div>
              <div>
                <strong className="text-foreground">Assign Approvers:</strong> Click &quot;Approvers&quot; button, add the Manager role (or
                specific manager users), mark as required.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                3
              </div>
              <div>
                <strong className="text-foreground">Assign to Category:</strong> Go to Categories, edit &quot;Maintenance&quot; category,
                select the approval from the dropdown, save.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                4
              </div>
              <div>
                <strong className="text-foreground">Create Task:</strong> Create &quot;Repair AC&quot; task with &quot;Maintenance&quot;
                category. Approval workflow starts automatically, task status becomes &quot;pending&quot;.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300">
                5
              </div>
              <div>
                <strong className="text-foreground">Manager Reviews:</strong> Manager receives notification, reviews task, approves or rejects.
                Task status updates to &quot;approved&quot; or &quot;rejected&quot; accordingly.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
            <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5" />
            Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-muted-foreground">
                <strong className="text-foreground">Use clear names:</strong> Name approvals descriptively so users understand their purpose.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-muted-foreground">
                <strong className="text-foreground">Set deadlines:</strong> Always set reasonable deadlines to ensure timely approvals.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-muted-foreground">
                <strong className="text-foreground">Require comments:</strong> Enable rejection comments to maintain clear communication.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-muted-foreground">
                <strong className="text-foreground">Use roles when possible:</strong> Assign approvals to roles rather than individual users for easier maintenance.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-muted-foreground">
                <strong className="text-foreground">Test workflows:</strong> Create test tasks to verify approval workflows work as expected.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span className="text-muted-foreground">
                <strong className="text-foreground">Document conditions:</strong> If using conditional triggers, document the conditions clearly for future reference.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Troubleshooting</CardTitle>
          <CardDescription>Common issues and solutions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 border rounded-lg bg-muted/30">
            <div className="font-semibold text-foreground mb-1">Approval not starting automatically</div>
            <p className="text-sm text-muted-foreground">
              Check that the trigger type is set to &quot;ON_CREATE&quot; and the approval is assigned to the task&apos;s category or template.
              Ensure the approval is marked as &quot;Active&quot;.
            </p>
          </div>

          <div className="p-3 border rounded-lg bg-muted/30">
            <div className="font-semibold text-foreground mb-1">Approvers not receiving notifications</div>
            <p className="text-sm text-muted-foreground">
              Verify that approvers are correctly assigned to the approval. Check user notification settings and ensure the approval workflow has started.
            </p>
          </div>

          <div className="p-3 border rounded-lg bg-muted/30">
            <div className="font-semibold text-foreground mb-1">Task stuck in pending status</div>
            <p className="text-sm text-muted-foreground">
              Ensure all required approvers have reviewed the task. Check if any approvers are missing or if the approval requirements are configured correctly.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="pt-6 border-t text-sm text-muted-foreground flex items-center gap-2">
        <FontAwesomeIcon icon={faCircleQuestion} className="w-4 h-4" />
        Need more help? Ask an admin or check your organization&apos;s SOPs.
      </div>
    </div>
  );
};

