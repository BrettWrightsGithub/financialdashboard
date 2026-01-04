import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { InlineEditCell } from "./InlineEditCell";

describe("InlineEditCell", () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  it("renders the formatted currency value", () => {
    render(<InlineEditCell value={1234.56} onSave={mockOnSave} />);
    
    expect(screen.getByText("$1,234.56")).toBeInTheDocument();
  });

  it("enters edit mode when clicked", () => {
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    const button = screen.getByRole("button");
    fireEvent.click(button);
    
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
  });

  it("saves on Enter key press", async () => {
    mockOnSave.mockResolvedValue(undefined);
    
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    // Change value and press Enter
    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.keyDown(input, { key: "Enter" });
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(150);
    });
  });

  it("saves on blur", async () => {
    mockOnSave.mockResolvedValue(undefined);
    
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    // Change value and blur
    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.blur(input);
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(150);
    });
  });

  it("cancels on Escape key press", () => {
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    // Press Escape
    const input = screen.getByDisplayValue("100");
    fireEvent.keyDown(input, { key: "Escape" });
    
    // Should exit edit mode without saving
    expect(screen.queryByDisplayValue("100")).not.toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("validates numeric input", async () => {
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    // Enter invalid text
    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    
    // Should show error and not save
    expect(screen.getByText("Invalid number")).toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("handles empty input on blur", () => {
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    // Clear input and blur
    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    
    // Should exit edit mode without saving
    expect(screen.queryByDisplayValue("100")).not.toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it("formats currency with different values", () => {
    const { rerender } = render(<InlineEditCell value={0} onSave={mockOnSave} />);
    expect(screen.getByText("$0")).toBeInTheDocument();
    
    rerender(<InlineEditCell value={-123.45} onSave={mockOnSave} />);
    expect(screen.getByText("-$123.45")).toBeInTheDocument();
    
    rerender(<InlineEditCell value={999999.99} onSave={mockOnSave} />);
    expect(screen.getByText("$999,999.99")).toBeInTheDocument();
  });

  it("shows loading state during save", async () => {
    mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode and save
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.keyDown(input, { key: "Enter" });
    
    // Should show loading spinner
    expect(screen.getByRole("generic", { name: /loading/i })).toBeInTheDocument();
  });

  it("shows error message on save failure", async () => {
    mockOnSave.mockRejectedValue(new Error("Save failed"));
    
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode and save
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.keyDown(input, { key: "Enter" });
    
    await waitFor(() => {
      expect(screen.getByText("Failed to save")).toBeInTheDocument();
    });
  });

  it("is disabled when disabled prop is true", () => {
    render(<InlineEditCell value={100} onSave={mockOnSave} disabled />);
    
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("cursor-not-allowed", "opacity-50");
  });

  it("applies custom className", () => {
    render(<InlineEditCell value={100} onSave={mockOnSave} className="custom-class" />);
    
    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });

  it("uses custom testId", () => {
    render(<InlineEditCell value={100} onSave={mockOnSave} testId="test-input" />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    expect(screen.getByTestId("test-input")).toBeInTheDocument();
  });

  it("handles decimal input correctly", async () => {
    mockOnSave.mockResolvedValue(undefined);
    
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    // Enter decimal value
    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "123.45" } });
    fireEvent.keyDown(input, { key: "Enter" });
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(123.45);
    });
  });

  it("handles negative input correctly", async () => {
    mockOnSave.mockResolvedValue(undefined);
    
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    // Enter negative value
    const input = screen.getByDisplayValue("100");
    fireEvent.change(input, { target: { value: "-50" } });
    fireEvent.keyDown(input, { key: "Enter" });
    
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(-50);
    });
  });

  it("filters invalid characters during input", () => {
    render(<InlineEditCell value={100} onSave={mockOnSave} />);
    
    // Enter edit mode
    fireEvent.click(screen.getByRole("button"));
    
    const input = screen.getByDisplayValue("100");
    
    // Try to enter invalid characters
    fireEvent.change(input, { target: { value: "12a34b" } });
    expect(input).toHaveValue("12a34b"); // Should allow during typing but validate on save
    
    // Try to enter valid characters
    fireEvent.change(input, { target: { value: "123.45" } });
    expect(input).toHaveValue("123.45");
  });
});
