import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { coverColorFor } from '../theme/coverPalette';
import { COVER_INK, space, type as typeTokens } from '../theme/tokens';
import type { Book } from '../types/database';

type Size = 'xs' | 'sm' | 'md' | 'lg';

/** Largura por tamanho. A altura sai da proporcao 2:3 de livro. */
const WIDTH: Record<Size, number> = { xs: 48, sm: 74, md: 108, lg: 160 };
const TITLE_SIZE: Record<Size, number> = { xs: 0, sm: 11, md: 15, lg: 21 };

interface Props {
  book: Pick<Book, 'id' | 'title' | 'author' | 'cover_url'>;
  size?: Size;
  style?: ViewStyle;
}

// A capa e a midia principal do app. Sem cover_url, o app desenha uma capa de
// colecao; com cover_url (BER-72), a capa real entra POR CIMA da gerada, que
// segue atras como placeholder enquanto a imagem baixa.
export function Cover({ book, size = 'md', style }: Props) {
  const width = WIDTH[size];
  const height = Math.round(width * 1.5);
  const titleSize = TITLE_SIZE[size];
  const showText = titleSize > 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${book.title}, de ${book.author}`}
      style={[{ width, height }, style]}
    >
      <View
        testID="cover-generated"
        style={[
          styles.generated,
          { width, height, backgroundColor: coverColorFor(book.id), padding: size === 'xs' ? space.xs : space.md - 1 },
        ]}
      >
        {/* Lombada: duas linhas finas dao a leitura de objeto sem desenhar nada. */}
        <View style={styles.spine} pointerEvents="none" />
        {showText ? (
          <>
            <Text
              numberOfLines={4}
              style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.08 }]}
            >
              {book.title}
            </Text>
            <Text numberOfLines={1} style={[styles.author, { fontSize: Math.max(7, titleSize * 0.52) }]}>
              {book.author}
            </Text>
          </>
        ) : null}
      </View>

      {book.cover_url ? (
        <Image
          testID="cover-real"
          source={{ uri: book.cover_url }}
          style={[styles.real, { width, height }]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  generated: {
    borderRadius: 3,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 26,
    elevation: 8,
  },
  spine: {
    position: 'absolute',
    left: 5,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  title: {
    fontFamily: typeTokens.heading.fontFamily,
    color: COVER_INK,
  },
  author: {
    fontFamily: typeTokens.label.fontFamily,
    color: COVER_INK,
    opacity: 0.72,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    borderTopWidth: 1,
    borderTopColor: 'rgba(246,233,212,0.35)',
    paddingTop: space.xs + 1,
  },
  real: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 3,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
});
