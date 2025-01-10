import styled, { css } from "styled-components";
import { TooltipStyleProps } from "./types";

const positionStyles = {
  top: css`
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: ${({ theme }) => theme.spacing.sm};

    &::after {
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-color: ${({ theme }) => theme.colors.primary.main} transparent
        transparent transparent;
    }
  `,
  bottom: css`
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: ${({ theme }) => theme.spacing.sm};

    &::after {
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-color: transparent transparent
        ${({ theme }) => theme.colors.primary.main} transparent;
    }
  `,
  left: css`
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-right: ${({ theme }) => theme.spacing.sm};

    &::after {
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-color: transparent transparent transparent
        ${({ theme }) => theme.colors.primary.main};
    }
  `,
  right: css`
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: ${({ theme }) => theme.spacing.sm};

    &::after {
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-color: transparent ${({ theme }) => theme.colors.primary.main}
        transparent transparent;
    }
  `,
};

export const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
`;

export const TooltipContent = styled.div<TooltipStyleProps>`
  position: absolute;
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.background.secondary};
  border: 1px solid ${({ theme }) => theme.colors.primary.main};
  color: ${({ theme }) => theme.colors.text.primary};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  white-space: initial;
  z-index: 1000;

  // Positioning
  ${({ $position }) => positionStyles[$position]}

  // Size constraints and overflow
  max-width: ${({ $maxWidth }) => $maxWidth || "300px"};
  max-height: ${({ $maxHeight }) => $maxHeight || "200px"};
  overflow-y: auto;
  overflow-x: hidden;
  word-wrap: break-word;
  white-space: pre-wrap;

  // Visibility
  visibility: hidden;
  opacity: 0;
  transition: visibility 0s linear 0.2s, opacity 0.2s ease-in-out;

  ${TooltipContainer}:hover & {
    visibility: visible;
    opacity: 1;
    transition-delay: 0.5s; // Delay before showing
  }

  // Arrow
  &::after {
    content: "";
    position: absolute;
    border-width: 5px;
    border-style: solid;
  }

  // Scrollbar styling
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background.primary};
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.primary.main};
    border-radius: 3px;
  }
`;

export const TooltipTitle = styled.div`
  font-weight: bold;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  white-space: nowrap;
`;

export const TooltipList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};

  // Each item in the list
  > div {
    white-space: nowrap;
  }
`;
