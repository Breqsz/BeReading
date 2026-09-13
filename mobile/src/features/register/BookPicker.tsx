// A troca de livro inline do sheet (BER-44): quem le dois livros registra o
// segundo sem sair daqui. Uma linha por livro em andamento.
import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { ListRow } from '../../ui/ListRow';
import { Cover } from '../../ui/Cover';
import { color } from '../../theme/tokens';
import type { BookChoice } from '../../utils/registerReading';

interface Props {
  choices: BookChoice[];
  selectedId: string;
  onChoose: (choice: BookChoice) => void;
}

export function BookPicker({ choices, selectedId, onChoose }: Props) {
  return (
    <View>
      {choices.map((choice, i) => (
        <ListRow
          key={choice.book.id}
          title={choice.book.title}
          subtitle={`pág. ${choice.studentBook.current_page} de ${choice.book.total_pages}`}
          leading={<Cover book={choice.book} size="xs" />}
          trailing={
            choice.book.id === selectedId ? (
              // Decorativo: o livro atual ja esta nomeado na linha de cima.
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Check size={18} color={color.text} strokeWidth={2.2} />
              </View>
            ) : null
          }
          onPress={() => onChoose(choice)}
          accessibilityLabel={`Escolher ${choice.book.title}`}
          last={i === choices.length - 1}
        />
      ))}
    </View>
  );
}
