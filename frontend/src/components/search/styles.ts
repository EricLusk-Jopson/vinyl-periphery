import styled from "styled-components";

export const SearchFormContainer = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const Label = styled.label`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  color: ${({ theme }) => theme.colors.text.secondary};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.normal};
`;

export const Input = styled.input`
  background-color: ${({ theme }) => theme.colors.background.secondary};
  color: ${({ theme }) => theme.colors.text.primary};
  padding: ${({ theme }) => theme.spacing.sm};
  border: none;
  border-radius: 4px;
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
  }
`;

export const SubmitButton = styled.button`
  background-color: ${({ theme }) => theme.colors.primary.main};
  color: ${({ theme }) => theme.colors.text.primary};
  padding: ${({ theme }) => theme.spacing.sm};
  border: none;
  border-radius: 4px;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary.dark};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.primary.main};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
  text-align: center;
`;

export const ResultsList = styled.ul`
  list-style: none;
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

export const ResultItem = styled.li`
  background: ${({ theme }) => theme.colors.background.secondary};
  padding: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
`;

export const ResultTitle = styled.h3`
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

export const ResultMeta = styled.div`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;
