import { fireEvent, render, screen } from '@testing-library/react';
import { ImageUploadSection } from './ImageUploadSection';

describe('ImageUploadSection', () => {
  it('treats uploaded filenames as text in the expanded preview', () => {
    const name = '\"><script data-injected="true"></script><img alt="';
    const file = new File(['image'], name, { type: 'image/png' });
    const image = {
      file,
      name,
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    };

    render(
      <ImageUploadSection
        darkMode={false}
        selectedPlatform="linkedin"
        attachedImages={[image]}
        platformImageSelections={{}}
        onImageUpload={jest.fn()}
        onRemoveImage={jest.fn()}
        onRemoveAllImages={jest.fn()}
        onSelectImagesForPlatform={jest.fn()}
        getSelectedImagesForPlatform={() => [image]}
        onDragStart={jest.fn()}
        onDragOver={jest.fn()}
        onDrop={jest.fn()}
      />
    );

    fireEvent.click(screen.getByAltText('Attached image 1'));

    expect(document.querySelector('[data-injected="true"]')).toBeNull();
    expect(screen.getByAltText(name)).toBeInTheDocument();
  });
});
