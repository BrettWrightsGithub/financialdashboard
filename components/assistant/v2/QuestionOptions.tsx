import { useMemo, useState } from "react";
import type { AssistantStructuredQuestion } from "@/lib/assistant/chatTypes";

interface QuestionOptionsProps {
  question: AssistantStructuredQuestion;
  disabled?: boolean;
  onSubmit: (answer: { selectedOptionIds?: string[]; otherText?: string }) => void;
}

export function QuestionOptions({ question, disabled = false, onSubmit }: QuestionOptionsProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");

  const canSubmit = useMemo(() => {
    if (question.required) {
      return selected.length > 0 || otherText.trim().length > 0;
    }
    return true;
  }, [otherText, question.required, selected]);

  const toggleOption = (optionId: string) => {
    setSelected((previous) => {
      if (question.multi_select) {
        return previous.includes(optionId)
          ? previous.filter((id) => id !== optionId)
          : [...previous, optionId];
      }
      return previous.includes(optionId) ? [] : [optionId];
    });
  };

  return (
    <fieldset data-question-id={question.id} className="assistant-v2-question">
      <legend className="assistant-v2-question-title">{question.prompt}</legend>
      <div className="assistant-v2-question-options">
        {question.options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              className={`assistant-v2-question-option ${checked ? "assistant-v2-question-option-active" : ""}`}
              onClick={() => toggleOption(option.id)}
            >
              <span>{option.label}</span>
              {option.description ? (
                <span className="assistant-v2-question-option-description">{option.description}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <textarea
        value={otherText}
        disabled={disabled}
        onChange={(event) => setOtherText(event.target.value)}
        className="assistant-v2-textarea"
        rows={2}
        placeholder="Other (optional)"
      />
      <div className="assistant-v2-question-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={disabled || !canSubmit}
          onClick={() => onSubmit({ selectedOptionIds: selected, otherText })}
        >
          Submit answer
        </button>
      </div>
    </fieldset>
  );
}
