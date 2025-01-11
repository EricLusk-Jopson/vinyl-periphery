import styled from "styled-components";
import { SheetContent, SheetHeader } from "../ui/sheet";

export const StyledFilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.primary.main};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.primary.dark};
  }
`;

export const ModalContent = styled(SheetContent)`
  background: ${({ theme }) => theme.colors.background.primary};
  border-left: 1px solid ${({ theme }) => theme.colors.primary.main};
  padding: ${({ theme }) => theme.spacing.xl};
`;

export const HeaderContainer = styled(SheetHeader)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing.xl};
`;

export const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.sm};

  &:hover {
    color: ${({ theme }) => theme.colors.primary.main};
  }
`;
