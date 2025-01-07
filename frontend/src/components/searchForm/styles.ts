import styled from "styled-components";

export const Form = styled.form`
  display: grid;
  gap: ${({ theme }) => theme.spacing.md};
  max-width: 600px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.background.secondary};
`;

export const InputGroup = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const Label = styled.label`
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.normal};
`;

export const Input = styled.input`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.primary.main};
  background: ${({ theme }) => theme.colors.background.primary};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  width: 100%;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary.dark};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.secondary};
  }
`;

export const SubmitButton = styled.button<{ $isSearching: boolean }>`
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme, $isSearching }) =>
    $isSearching ? theme.colors.text.disabled : theme.colors.primary.main};
  color: ${({ theme }) => theme.colors.text.primary};
  border: none;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.normal};
  cursor: ${({ $isSearching }) => ($isSearching ? "wait" : "pointer")};
  transition: background-color 0.2s ease-in-out;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primary.dark};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

export const SearchingIndicator = styled.div`
  text-align: center;
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;
