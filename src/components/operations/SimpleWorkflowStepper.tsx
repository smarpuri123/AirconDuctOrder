import { Check, Circle } from 'lucide-react'
import type { WorkflowStep } from '@/types/enquiry'

interface SimpleWorkflowStepperProps {
  steps: WorkflowStep[]
}

export function SimpleWorkflowStepper({ steps }: SimpleWorkflowStepperProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      {steps.map((step, i) => (
        <div key={step.stage} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center flex-1 min-w-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0 ${
                step.status === 'completed'
                  ? 'bg-primary border-primary text-white'
                  : step.status === 'current'
                    ? 'bg-secondary border-secondary text-white'
                    : 'bg-surface border-border text-text-secondary'
              }`}
            >
              {step.status === 'completed' ? (
                <Check className="w-4 h-4" />
              ) : (
                <Circle className="w-3 h-3" fill={step.status === 'current' ? 'currentColor' : 'none'} />
              )}
            </div>
            <p
              className={`text-[11px] font-medium mt-2 text-center leading-tight ${
                step.status === 'current' ? 'text-secondary' : 'text-text-secondary'
              }`}
            >
              {step.label}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 flex-1 mx-1 mb-6 min-w-[12px] ${
                step.status === 'completed' ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
