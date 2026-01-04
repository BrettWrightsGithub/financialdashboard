import { render, screen } from "@testing-library/react";
import { BudgetAllocationBar } from "./BudgetAllocationBar";

describe("BudgetAllocationBar", () => {
  it("renders with good allocation status", () => {
    render(<BudgetAllocationBar totalIncome={5000} totalAllocated={3000} />);
    
    expect(screen.getByText("Total Income")).toBeInTheDocument();
    expect(screen.getByText("$5,000")).toBeInTheDocument();
    expect(screen.getByText("Allocated")).toBeInTheDocument();
    expect(screen.getByText("$3,000")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText("$2,000")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows warning for low remaining buffer", () => {
    render(<BudgetAllocationBar totalIncome={5000} totalAllocated={4600} />);
    
    expect(screen.getByText("Low remaining buffer")).toBeInTheDocument();
    expect(screen.getByText("$400")).toBeInTheDocument();
  });

  it("shows error for over allocation", () => {
    render(<BudgetAllocationBar totalIncome={5000} totalAllocated={5500} />);
    
    expect(screen.getByText("Over allocated by $500")).toBeInTheDocument();
  });

  it("handles zero income", () => {
    render(<BudgetAllocationBar totalIncome={0} totalAllocated={0} />);
    
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("displays correct progress bar width", () => {
    const { container } = render(<BudgetAllocationBar totalIncome={1000} totalAllocated={750} />);
    
    const progressBar = container.querySelector('.bg-blue-500');
    expect(progressBar).toHaveStyle({ width: '75%' });
  });

  it("shows different colors based on allocation status", () => {
    const { container: goodContainer } = render(
      <BudgetAllocationBar totalIncome={5000} totalAllocated={3000} />
    );
    const goodBar = goodContainer.querySelector('.bg-blue-500');
    expect(goodBar).toBeInTheDocument();

    const { container: lowContainer } = render(
      <BudgetAllocationBar totalIncome={5000} totalAllocated={4600} />
    );
    const lowBar = lowContainer.querySelector('.bg-yellow-500');
    expect(lowBar).toBeInTheDocument();

    const { container: overContainer } = render(
      <BudgetAllocationBar totalIncome={5000} totalAllocated={5500} />
    );
    const overBar = overContainer.querySelector('.bg-red-500');
    expect(overBar).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<BudgetAllocationBar totalIncome={1000} totalAllocated={500} className="custom-class" />);
    
    const container = screen.getByText("Total Income").closest('div');
    expect(container).toHaveClass("custom-class");
  });

  it("handles edge case of exact 10% remaining", () => {
    render(<BudgetAllocationBar totalIncome={1000} totalAllocated={900} />);
    
    expect(screen.getByText("Low remaining buffer")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("handles negative allocated amount", () => {
    render(<BudgetAllocationBar totalIncome={5000} totalAllocated={-1000} />);
    
    expect(screen.getByText("$6,000")).toBeInTheDocument(); // 5000 - (-1000) = 6000 remaining
    expect(screen.getByText("-20%")).toBeInTheDocument(); // (-1000 / 5000) * 100 = -20%
  });
});
