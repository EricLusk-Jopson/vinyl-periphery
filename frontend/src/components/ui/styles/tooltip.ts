import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import styled from "styled-components";

export const StyledTooltipContent = styled(TooltipPrimitive.Content)`
  z-index: 50;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 2px solid ${({ theme }) => theme.colors.border.light};
  background-color: ${({ theme }) => theme.colors.background.primary};
  color: ${({ theme }) => theme.colors.text.primary};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  box-shadow: 0 0 100px 100px rgba(0, 0, 0, 0.1);
  margin: ${({ theme }) => theme.spacing.md};

  /* Separate animations for in/out */
  &[data-state="delayed-open"] {
    animation: fadeIn 0.2s ease-in-out;
  }

  &[data-state="closed"] {
    animation: fadeOut 0.1s ease-in-out forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }
`;
