// Linha do catalogo (spec 7.8): capa, titulo, autor e o estado do livro pro
// leitor. Toque na linha abre o detalhe; "Comecar" poe na estante.
import { Button, Cover, ListRow, Tag } from '../../ui';
import type { Book } from '../../types/database';
import type { ExploreState } from './logic';

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url'>;
  state: ExploreState;
  starting: boolean;
  onOpen: () => void;
  onStart: () => void;
  last?: boolean;
}

export function ExploreBookRow({ book, state, starting, onOpen, onStart, last = false }: Props) {
  const trailing =
    state === 'reading' ? <Tag label="Lendo" tone="accent" />
    : state === 'finished' ? <Tag label="Lido" tone="positive" />
    : (
      <Button variant="secondary" onPress={onStart} loading={starting} accessibilityLabel={`Começar ${book.title}`}>
        Começar
      </Button>
    );

  return (
    <ListRow
      title={book.title}
      subtitle={book.author}
      leading={<Cover book={book} size="xs" />}
      trailing={trailing}
      onPress={onOpen}
      accessibilityLabel={`Abrir ${book.title}, de ${book.author}.`}
      last={last}
    />
  );
}
