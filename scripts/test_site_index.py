import importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('index',Path(__file__).with_name('build-site-index.py'))
index=importlib.util.module_from_spec(spec);spec.loader.exec_module(index)
class SearchSafetyTests(unittest.TestCase):
 def test_nested_spoilers_do_not_enter_summary(self):
  source='{{Page\n|title=Test\n}}\n\nPublic opening. {{Spoiler|Secret identity with {{Spoiler|nested secret}} here.}}\n\n== History ==\nLater events.'
  self.assertEqual(index.summary(source),'Public opening.')
  self.assertNotIn('secret',index.strip_templates(source).lower())
 def test_gender_and_damage_match_data(self):
  roster={'c1':{'nickname':'Avery','gender':'male'},'c1b':{'nickname':'Caela','gender':'female'}}
  text='{{nickname}} raises {{possessive}} hand. {{Subject}} heals <span data-dmg="heal"></span>%.'
  self.assertEqual(index.nickname_text(text,roster,'c1b',damage={'heal':30}),'Caela raises her hand. She heals 30%.')
 def test_catalogue_links_only_readable_books(self):
  books=index.build()['data/books.json']['books']
  for book in books:
   if book['available']:self.assertTrue((index.ROOT/f"books/pdf/Mystical Legends {book['id']}.pdf").exists())
   else:self.assertTrue(book['path'].startswith('/books_main.html#'))
 def test_disabled_characters_stay_out_of_public_game_index(self):
  roster=json.loads((index.ROOT/'images/mlg-assets/data-character.json').read_text());records=index.build()['data/search-index.json']['records']
  for cid,character in roster.items():
   if cid.startswith('#'):self.assertFalse(any(r['type']=='Character' and r['title']==character['name'] for r in records))

class ContentCheckTests(unittest.TestCase):
 def test_new_missing_skill_placeholder_and_damage_are_reported(self):
  spec=importlib.util.spec_from_file_location('checker',Path(__file__).with_name('check-content.py'));checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);checker.ROOT=root
   (root/'images/mlg-assets/Characters/C1').mkdir(parents=True)
   (root/'images/mlg-assets/data-character.json').write_text(json.dumps({'c1':{'nickname':'Avery','gender':'male','skills':['B1','S9']}}))
   (root/'images/mlg-assets/data-effects.json').write_text('{}')
   (root/'images/mlg-assets/Characters/C1/c1.json').write_text(json.dumps({'B1':{'description':'{{subject:c99}} {{effect:missing}} <span data-dmg="absent"></span>','base_damage':{}}}))
   issues='\n'.join(checker.audit())
   for expected in ['missing skill: c1/S9','missing placeholder character: c99','missing effect: missing','missing damage value: B1/absent']:self.assertIn(expected,issues)

if __name__=='__main__':unittest.main()
