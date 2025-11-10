import { registerRoot } from 'remotion';
import { GraphycsComposition } from './Composition';

registerRoot(() => {
  return (
    <>
      <GraphycsComposition
        storyboard={{
          title: '',
          language: '',
          intro: '',
          overview: [],
          modules: [],
          summary: '',
          quiz: []
        }}
      />
    </>
  );
});
