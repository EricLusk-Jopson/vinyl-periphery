import { SheetClose, SheetContent } from "@/components/ui/sheet";
import styled from "styled-components";

export const HeaderWrapper = styled.header<{ $visible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: ${({ theme }) => theme.colors.background.primary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.primary};
  transform: translateY(${({ $visible }) => ($visible ? "0" : "-100%")});
  transition: transform ${({ theme }) => theme.transitions.normal};
  z-index: ${({ theme }) => theme.zIndex.header};
`;

export const HeaderContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.md};
  max-width: ${({ theme }) => theme.breakpoints.lg};
  margin: 0 auto;
  width: 100%;
`;

export const StyledTitle = styled.h1`
  color: ${({ theme }) => theme.colors.primary.main};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
  margin: 0;
`;

export const HeaderButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.primary};
  padding: ${({ theme }) => theme.spacing.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${({ theme }) => theme.colors.primary.main};
  }
`;

export const StyledSheetContent = styled(SheetContent)`
  background-color: ${({ theme }) => theme.colors.background.primary};
  border-left: 1px solid ${({ theme }) => theme.colors.border.primary};
  z-index: ${({ theme }) => theme.zIndex.modal};
  position: fixed;
  top: 0;
  bottom: 0;
  padding: ${({ theme }) => theme.spacing.xl};
  overflow-y: auto; // Make the entire sheet content scrollable
  overflow-x: hidden;

  &[data-side="right"] {
    border-left: 1px solid ${({ theme }) => theme.colors.border.primary};
  }

  &[data-side="left"] {
    border-right: 1px solid ${({ theme }) => theme.colors.border.primary};
  }
`;

export const CloseButton = styled(SheetClose)`
  position: absolute;
  right: ${({ theme }) => theme.spacing.md};
  top: ${({ theme }) => theme.spacing.md};
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.sm};

  &:hover {
    color: ${({ theme }) => theme.colors.primary.main};
  }
`;

export const FilterContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-top: ${({ theme }) => theme.spacing.xl};
  width: 100%;
`;

export const AppContainer = styled.div`
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.background.primary};
`;

export const MainContent = styled.main`
  width: 100%;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
  gap: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  align-items: center;
`;
